import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pino from "pino";
import { config } from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Python daemon configuration
const DAEMON_PORT = 9876;
const DAEMON_URL = `http://127.0.0.1:${DAEMON_PORT}`;
import {
	createDevice,
	deviceQueries,
	getCredentials,
	saveCredentials,
} from "../db/queries.js";
import { decrypt, encrypt } from "../lib/crypto.js";
import type { RoborockCommandParam } from "../types.js";

const log = pino({ name: "roborock" });

// Roborock API endpoints
const API_V1_GET_URL = "api/v1/getUrlByEmail";
const API_V1_HOME_DETAIL = "api/v1/getHomeDetail";
const API_V3_SIGN = "api/v3/key/sign";
const API_V4_SEND_CODE = "api/v4/email/code/send";
const API_V4_LOGIN_CODE = "api/v4/auth/email/login/code";

// API Response Types
interface RoborockApiResponse<T = unknown> {
	code: number;
	msg: string;
	data: T | null;
}

interface GetUrlByEmailData {
	url: string;
	country: string | null;
	countrycode: string | null;
}

interface SignKeyData {
	k: string;
}

interface LoginData {
	token: string;
	userid?: string;
	uid?: number;
	rruid?: string;
	rriot?: RRiot;
}

interface HomeDetailData {
	rrHomeId: number;
}

// IoT API Response Types
interface IoTApiResponse<T = unknown> {
	success: boolean;
	result: T | null;
}

interface DeviceStatus {
	[key: string]: number;
}

/**
 * DPS (Data Point Service) keys for Roborock device status.
 * These are the keys used in the deviceStatus object from the IoT API.
 */
const DPS_KEYS = {
	ERROR_CODE: "120",
	STATE: "121",
	BATTERY: "122",
	FAN_POWER: "123",
	WATER_BOX_MODE: "124",
	MAIN_BRUSH_WORK_TIME: "125",
	SIDE_BRUSH_WORK_TIME: "126",
	FILTER_WORK_TIME: "127",
	ADDITIONAL_PROPS: "128",
	TASK_COMPLETE: "130",
	TASK_CANCEL_LOW_POWER: "131",
	TASK_CANCEL_IN_MOTION: "132",
	CHARGE_STATUS: "133",
	DRYING_STATUS: "134",
	OFFLINE_STATUS: "135",
} as const;

interface HomeDevice {
	duid: string;
	name: string;
	localKey: string;
	productId: string;
	fv: string | null;
	online: boolean;
	model?: string;
	deviceStatus: DeviceStatus | null;
	activeTime?: number;
	createTime?: number;
	timeZoneId?: string;
	sn?: string;
}

interface HomeData {
	id: number;
	name: string;
	devices: HomeDevice[];
}

// Clean history record type
interface CleanHistoryRecord {
	id: number;
	startTime: number;
	endTime: number;
	duration: number;
	area: number;
	errorCode: number;
	completed: boolean;
}

// RRiot credentials for HAWK authentication
interface RRiotReference {
	a: string; // IoT API endpoint
	m?: string; // MQTT endpoint
	l?: string;
}

interface RRiot {
	u: string; // user id
	s: string; // secret
	h: string; // hmac key
	k: string; // key
	r: RRiotReference;
}

interface RoborockCredentials {
	token: string;
	userId: string;
	homeId: string;
	rruid?: string;
	baseURL: string;
	rriot?: RRiot;
}

interface IotLoginInfo {
	baseURL: string;
	country: string;
	countryCode: string;
}

interface PendingAuth {
	email: string;
	baseURL: string;
	deviceIdentifier: string;
	country: string;
	countryCode: string;
}

export interface RoborockDeviceState {
	id: string;
	name: string;
	model: string;
	status:
		| "idle"
		| "cleaning"
		| "returning"
		| "charging"
		| "paused"
		| "error"
		| "offline";
	battery: number;
	fanSpeed: "quiet" | "balanced" | "turbo" | "max";
	waterLevel: "off" | "low" | "medium" | "high";
	cleanArea: number;
	cleanTime: number;
	errorCode: number;
	errorMessage: string | null;
	lastClean: string | null;
}

// MQTT status response from Python bridge (get_status command)
export interface RoborockMqttStatus {
	state?: number;
	battery?: number;
	fan_power?: number;
	water_box_mode?: number;
	main_brush_work_time?: number;
	side_brush_work_time?: number;
	filter_work_time?: number;
	clean_area?: number;
	clean_time?: number;
	error_code?: number;
	in_cleaning?: number;
	in_returning?: number;
	in_fresh_state?: number;
	[key: string]: unknown;
}

// DPS state value mappings for status decoding
// State 8 = charging, 5/7/11/16/17/18 = cleaning, 6/15 = returning, 10 = paused, 12/13 = error

// Error categories for command failures
export type RoborockErrorCategory =
	| "device_offline"
	| "auth_expired"
	| "command_timeout"
	| "missing_credentials"
	| "unknown";

export interface CommandResult {
	success: boolean;
	error?: string;
	errorCategory?: RoborockErrorCategory;
}

/**
 * Categorize an error message from the Python bridge or internal errors.
 */
function categorizeError(error: string): RoborockErrorCategory {
	const lowerError = error.toLowerCase();
	if (lowerError.includes("timeout") || lowerError.includes("timed out")) {
		return "command_timeout";
	}
	if (
		lowerError.includes("offline") ||
		lowerError.includes("not reachable") ||
		lowerError.includes("connection refused") ||
		lowerError.includes("connection failed")
	) {
		return "device_offline";
	}
	if (
		lowerError.includes("auth") ||
		lowerError.includes("unauthorized") ||
		lowerError.includes("expired") ||
		lowerError.includes("invalid token") ||
		lowerError.includes("credentials")
	) {
		return "auth_expired";
	}
	return "unknown";
}

const DPS_STATE_CHARGING = 8;
const DPS_STATE_PAUSED = 10;
const DPS_STATES_CLEANING = new Set([5, 7, 11, 16, 17, 18]);
const DPS_STATES_RETURNING = new Set([6, 15]);
const DPS_STATES_ERROR = new Set([12, 13]);


/**
 * Determine device status from DPS state value.
 * Extracted to reduce cognitive complexity.
 */
function getStatusFromDpsState(
	dpsState: number,
): RoborockDeviceState["status"] {
	if (dpsState === DPS_STATE_CHARGING) return "charging";
	if (DPS_STATES_CLEANING.has(dpsState)) return "cleaning";
	if (DPS_STATES_RETURNING.has(dpsState)) return "returning";
	if (dpsState === DPS_STATE_PAUSED) return "paused";
	if (DPS_STATES_ERROR.has(dpsState)) return "error";
	return "idle";
}

/**
 * Determine device status based on online state and DPS state.
 * Extracted to reduce cognitive complexity.
 */
function determineDeviceStatus(
	online: boolean,
	dpsState: number | undefined,
): RoborockDeviceState["status"] {
	if (!online) return "offline";
	if (dpsState === undefined) return "idle";
	return getStatusFromDpsState(dpsState);
}


class RoborockService extends EventEmitter {
	private readonly credentials = new Map<string, RoborockCredentials>();
	private readonly deviceStates = new Map<string, RoborockDeviceState>();
	private readonly pollingIntervals = new Map<string, NodeJS.Timeout>();
	private readonly pendingAuth = new Map<string, PendingAuth>();

	private readonly deviceLocalKeys = new Map<string, string>(); // deviceId -> localKey

	// Python daemon management for performance optimization
	private daemonProcess: ChildProcess | null = null;
	private daemonReady = false;
	private daemonInitializedUsers = new Set<string>();

	// Generate a unique device identifier (persisted per user session)
	private generateDeviceIdentifier(): string {
		return crypto.randomBytes(16).toString("base64url");
	}

	// Generate header_clientid as md5(email + deviceIdentifier) base64 encoded
	private getHeaderClientId(email: string, deviceIdentifier: string): string {
		const md5 = crypto.createHash("md5");
		md5.update(email);
		md5.update(deviceIdentifier);
		return md5.digest().toString("base64");
	}

	// Generate HAWK authentication header for IoT API calls
	private getHawkAuthentication(rriot: RRiot, url: string): string {
		const timestamp = Math.floor(Date.now() / 1000);
		const nonce = crypto.randomBytes(6).toString("base64url");

		const prestr = [
			rriot.u,
			rriot.s,
			nonce,
			timestamp.toString(),
			crypto.createHash("md5").update(url).digest("hex"),
			"",
			"",
		].join(":");

		const mac = crypto
			.createHmac("sha256", rriot.h)
			.update(prestr)
			.digest("base64");

		return `Hawk id="${rriot.u}", s="${rriot.s}", ts="${timestamp}", nonce="${nonce}", mac="${mac}"`;
	}

	// Get the IoT login info for a user's email (base URL, country, country code)
	private async getIotLoginInfo(
		email: string,
		deviceIdentifier: string,
	): Promise<IotLoginInfo> {
		// Start with US endpoint - it returns proper country info
		const defaultUrls = [
			"https://usiot.roborock.com",
			"https://euiot.roborock.com",
			"https://cniot.roborock.com",
		];

		for (const defaultUrl of defaultUrls) {
			try {
				const params = new URLSearchParams({
					email,
					needtwostepauth: "false",
				});

				const response = await fetch(
					`${defaultUrl}/${API_V1_GET_URL}?${params}`,
					{
						method: "POST",
						headers: {
							header_clientid: this.getHeaderClientId(email, deviceIdentifier),
						},
					},
				);

				const data =
					(await response.json()) as RoborockApiResponse<GetUrlByEmailData>;
				log.info(
					{
						code: data.code,
						url: data.data?.url,
						country: data.data?.country,
						countryCode: data.data?.countrycode,
					},
					"getUrlByEmail response",
				);

				if (data.code === 200 && data.data?.url) {
					// Use provided country/countryCode, default to US if not provided
					const country = data.data.country || "US";
					const countryCode = data.data.countrycode || "1";

					return {
						baseURL: data.data.url,
						country,
						countryCode,
					};
				}
			} catch (error) {
				log.warn(
					{ error, defaultUrl },
					"Failed to get URL from endpoint, trying next",
				);
			}
		}

		// Default to US endpoint if lookup fails
		log.warn("All getUrlByEmail attempts failed, using defaults");
		return {
			baseURL: "https://usiot.roborock.com",
			country: "US",
			countryCode: "1",
		};
	}

	// Generate random alphanumeric string for signing
	private generateRandomAlphanumeric(length: number): string {
		const chars =
			"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		let result = "";
		const bytes = crypto.randomBytes(length);
		for (let i = 0; i < length; i++) {
			result += chars[bytes[i] % chars.length];
		}
		return result;
	}

	// Get signing key for v4 API using the provided nonce
	private async getSignKey(
		baseURL: string,
		email: string,
		deviceIdentifier: string,
		nonce: string,
	): Promise<string> {
		const response = await fetch(`${baseURL}/${API_V3_SIGN}?s=${nonce}`, {
			method: "POST",
			headers: {
				header_clientid: this.getHeaderClientId(email, deviceIdentifier),
			},
		});

		const data = (await response.json()) as RoborockApiResponse<SignKeyData>;
		log.info({ code: data.code, hasK: !!data.data?.k }, "Sign key response");

		if (data.code !== 200 || !data.data?.k) {
			throw new Error(
				`Failed to get signing key: ${data.msg || "unknown error"}`,
			);
		}

		return data.data.k;
	}

	async authenticate(
		userId: string,
		email: string,
		_password: string,
	): Promise<{
		success: boolean;
		error?: string;
		twoFactorRequired?: boolean;
	}> {
		log.info({ userId, email }, "Roborock authentication attempt");
		try {
			const deviceIdentifier = this.generateDeviceIdentifier();
			// Get the IoT login info (base URL, country, countryCode)
			const iotInfo = await this.getIotLoginInfo(email, deviceIdentifier);
			const { baseURL, country, countryCode } = iotInfo;

			log.info(
				{ baseURL, country, countryCode },
				"Attempting password login - 2FA typically required",
			);

			// For password login, users typically need 2FA
			// Store pending auth and require 2FA code
			this.pendingAuth.set(userId, {
				email,
				baseURL,
				deviceIdentifier,
				country,
				countryCode,
			});

			return {
				success: false,
				twoFactorRequired: true,
				error:
					"Two-factor authentication required. Please enter the code sent to your email.",
			};
		} catch (error) {
			log.error({ error, userId }, "Roborock authentication error");
			return {
				success: false,
				error: error instanceof Error ? error.message : "Authentication failed",
			};
		}
	}

	async send2FACode(
		userId: string,
		email: string,
	): Promise<{ success: boolean; error?: string }> {
		log.info({ userId, email }, "Sending 2FA code via v4 API");
		try {
			const deviceIdentifier = this.generateDeviceIdentifier();
			// Get the IoT login info (base URL, country, countryCode)
			const iotInfo = await this.getIotLoginInfo(email, deviceIdentifier);
			const { baseURL, country, countryCode } = iotInfo;
			const headerClientId = this.getHeaderClientId(email, deviceIdentifier);

			// Use v4 sendEmailCode API
			const body = new URLSearchParams({
				email,
				type: "login",
				platform: "",
			});

			const response = await fetch(`${baseURL}/${API_V4_SEND_CODE}`, {
				method: "POST",
				headers: {
					header_clientid: headerClientId,
					header_clientlang: "en",
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: body.toString(),
			});

			const data = (await response.json()) as RoborockApiResponse<null>;
			log.info(
				{ code: data.code, msg: data.msg },
				"v4 Send email code response",
			);

			if (data.code !== 200) {
				if (data.code === 2008) {
					return {
						success: false,
						error: "Account does not exist. Please check your email.",
					};
				}
				if (data.code === 9002) {
					return {
						success: false,
						error: "Too many code requests. Please wait and try again.",
					};
				}
				return { success: false, error: data.msg || "Failed to send code" };
			}

			// Store pending auth info
			this.pendingAuth.set(userId, {
				email,
				baseURL,
				deviceIdentifier,
				country,
				countryCode,
			});
			return { success: true };
		} catch (error) {
			log.error({ error }, "Failed to send 2FA code");
			return {
				success: false,
				error: error instanceof Error ? error.message : "Failed to send code",
			};
		}
	}

	async verify2FACode(
		userId: string,
		code: string,
	): Promise<{ success: boolean; error?: string }> {
		log.info({ userId }, "Verifying 2FA code via v4 API");
		try {
			const pending = this.pendingAuth.get(userId);
			if (!pending) {
				return {
					success: false,
					error: "No pending authentication. Please start login again.",
				};
			}

			const { email, baseURL, deviceIdentifier, country, countryCode } =
				pending;
			const headerClientId = this.getHeaderClientId(email, deviceIdentifier);

			log.info(
				{ baseURL, email, country, countryCode },
				"Attempting v4 loginWithCode",
			);

			// Generate random alphanumeric nonce and get signing key for v4 API
			const xMercyKs = this.generateRandomAlphanumeric(16);
			const xMercyK = await this.getSignKey(
				baseURL,
				email,
				deviceIdentifier,
				xMercyKs,
			);

			// Use v4 loginWithCode API
			const body = new URLSearchParams({
				country,
				countryCode,
				email,
				code,
				majorVersion: "14",
				minorVersion: "0",
			});

			const loginResponse = await fetch(`${baseURL}/${API_V4_LOGIN_CODE}`, {
				method: "POST",
				headers: {
					header_clientid: headerClientId,
					"x-mercy-ks": xMercyKs,
					"x-mercy-k": xMercyK,
					"Content-Type": "application/x-www-form-urlencoded",
					header_clientlang: "en",
					header_appversion: "4.54.02",
					header_phonesystem: "iOS",
					header_phonemodel: "iPhone16,1",
				},
				body: body.toString(),
			});

			const loginData =
				(await loginResponse.json()) as RoborockApiResponse<LoginData>;
			log.info(
				{
					code: loginData.code,
					msg: loginData.msg,
					hasData: !!loginData.data,
					hasRriot: !!loginData.data?.rriot,
				},
				"v4 loginWithCode response",
			);

			if (loginData.code !== 200 || !loginData.data) {
				if (loginData.code === 2018) {
					return {
						success: false,
						error: "Invalid code. Please check and try again.",
					};
				}
				if (loginData.code === 3009) {
					return {
						success: false,
						error:
							"Please accept the user agreement in the Roborock app first.",
					};
				}
				if (loginData.code === 3006) {
					return {
						success: false,
						error: "User agreement must be accepted again in the Roborock app.",
					};
				}
				if (loginData.code === 3039) {
					return {
						success: false,
						error:
							"Account does not exist in this region. Please check your email.",
					};
				}
				return {
					success: false,
					error: loginData.msg || "Verification failed",
				};
			}

			this.pendingAuth.delete(userId);
			return this.completeLogin(userId, loginData.data, baseURL);
		} catch (error) {
			log.error({ error }, "2FA verification error");
			return {
				success: false,
				error: error instanceof Error ? error.message : "Verification failed",
			};
		}
	}

	private async completeLogin(
		userId: string,
		data: {
			token: string;
			userid?: string;
			uid?: number;
			rruid?: string;
			rriot?: RRiot;
		},
		baseURL: string,
	): Promise<{ success: boolean; error?: string }> {
		// v1 API returns uid as number, convert to string
		const roborockUserId = data.userid || (data.uid ? String(data.uid) : "");

		const creds: RoborockCredentials = {
			token: data.token,
			userId: roborockUserId,
			homeId: "", // Will be populated from home detail
			rruid: data.rruid,
			baseURL,
			rriot: data.rriot,
		};

		log.info(
			{
				roborockUserId: creds.userId,
				rruid: creds.rruid,
				hasRriot: !!creds.rriot,
				rriotEndpoint: creds.rriot?.r?.a,
			},
			"Roborock credentials obtained",
		);

		if (!creds.rriot) {
			log.warn(
				{ userId },
				"No rriot credentials received - device discovery will be limited",
			);
		}

		saveCredentials(
			userId,
			"roborock",
			encrypt(JSON.stringify(creds), config.ENCRYPTION_SECRET),
		);
		this.credentials.set(userId, creds);
		await this.discoverDevices(userId);
		this.startPolling(userId);

		log.info({ userId }, "Roborock authentication successful");
		return { success: true };
	}

	async connectWithStoredCredentials(userId: string): Promise<boolean> {
		try {
			const stored = getCredentials(userId, "roborock");
			if (!stored) {
				log.warn({ userId }, "No stored credentials found for Roborock");
				return false;
			}

			const creds = JSON.parse(
				decrypt(stored.credentials_encrypted, config.ENCRYPTION_SECRET),
			) as RoborockCredentials;

			log.info(
				{ userId, hasRriot: !!creds.rriot, hasMqtt: !!creds.rriot?.r?.m },
				"Loaded Roborock credentials",
			);

			this.credentials.set(userId, creds);
			await this.discoverDevices(userId);
			this.startPolling(userId);
			return true;
		} catch (err) {
			log.error({ userId, err }, "Failed to connect with stored credentials");
			return false;
		}
	}

	private async discoverDevices(userId: string): Promise<void> {
		const creds = this.credentials.get(userId);
		if (!creds) {
			log.warn({ userId }, "discoverDevices: No credentials found");
			return;
		}

		// Ensure baseURL has protocol
		const baseURL = creds.baseURL.startsWith("http")
			? creds.baseURL
			: `https://${creds.baseURL}`;

		log.info(
			{ userId, baseURL, hasRriot: !!creds.rriot },
			"Discovering Roborock devices",
		);

		try {
			// Step 1: Get home ID from basic API
			const homeResponse = await fetch(`${baseURL}/${API_V1_HOME_DETAIL}`, {
				headers: { Authorization: creds.token },
			});
			const homeData =
				(await homeResponse.json()) as RoborockApiResponse<HomeDetailData>;
			log.info(
				{
					status: homeResponse.status,
					code: homeData.code,
					rrHomeId: homeData.data?.rrHomeId,
				},
				"Roborock getHomeDetail response",
			);

			const rrHomeId = homeData.data?.rrHomeId;
			if (!rrHomeId) {
				log.warn(
					{ userId },
					"No rrHomeId found - authentication may need to be refreshed",
				);
				return;
			}

			// Store the homeId for later use
			creds.homeId = String(rrHomeId);

			// Step 2: Fetch devices from IoT API with HAWK authentication
			if (!creds.rriot) {
				log.warn(
					{ userId },
					"No rriot credentials - cannot fetch devices. Please re-authenticate.",
				);
				return;
			}

			if (!creds.rriot.r?.a) {
				log.error({ userId }, "Missing rriot API endpoint");
				return;
			}

			// IoT API endpoint
			const iotApiUrl = creds.rriot.r.a.startsWith("http")
				? creds.rriot.r.a
				: `https://${creds.rriot.r.a}`;
			const devicesPath = `/user/homes/${rrHomeId}`;

			log.info(
				{ iotApiUrl, devicesPath },
				"Fetching devices from IoT API with HAWK auth",
			);

			const hawkAuth = this.getHawkAuthentication(creds.rriot, devicesPath);

			const devicesResponse = await fetch(`${iotApiUrl}${devicesPath}`, {
				method: "GET",
				headers: {
					Authorization: hawkAuth,
				},
			});

			const devicesData =
				(await devicesResponse.json()) as IoTApiResponse<HomeData>;
			log.info(
				{
					status: devicesResponse.status,
					success: devicesData.success,
					hasResult: !!devicesData.result,
					deviceCount: devicesData.result?.devices?.length,
				},
				"Roborock IoT API devices response",
			);

			if (!devicesData.success || !devicesData.result) {
				log.error({ devicesData }, "IoT API returned error");
				return;
			}

			const devices: HomeDevice[] = devicesData.result.devices || [];

			for (const device of devices) {
				// Log full device data for debugging
				log.info({ device }, "Device data from IoT API");

				const deviceId = device.duid;
				const key = `${userId}:${deviceId}`;

				const existing = deviceQueries.findByType
					.all(userId, "roborock")
					.find((d) => d.device_id === deviceId);

				if (!existing) {
					createDevice(
						userId,
						"roborock",
						device.name || "Roborock Vacuum",
						deviceId,
						{
							model: device.model || device.productId,
							fwVersion: device.fv,
							localKey: device.localKey,
						},
					);
					log.info(
						{ deviceId, name: device.name, model: device.model },
						"Created new Roborock device",
					);
				}

				// Store localKey for Python bridge commands
				if (device.localKey) {
					this.deviceLocalKeys.set(deviceId, device.localKey);
				}

				// Parse device_status if available
				const deviceStatus = device.deviceStatus || {};
				const dpsState = deviceStatus[DPS_KEYS.STATE];
				const dpsBattery = deviceStatus[DPS_KEYS.BATTERY];

				// Map DPS state to status enum
				const status = determineDeviceStatus(device.online, dpsState);

				const battery = typeof dpsBattery === "number" ? dpsBattery : 0;

				log.info(
					{
						deviceId,
						online: device.online,
						dpsState,
						dpsBattery,
						status,
						battery,
					},
					"Parsed device status from home API",
				);

				this.deviceStates.set(key, {
					id: deviceId,
					name: device.name || "Roborock Vacuum",
					model: device.model || device.productId || "Unknown",
					status,
					battery,
					fanSpeed: "balanced",
					waterLevel: "medium",
					cleanArea: 0,
					cleanTime: 0,
					errorCode: 0,
					errorMessage: null,
					lastClean: null,
				});
			}

			log.info(
				{ userId, deviceCount: devices.length },
				"Device discovery complete",
			);
		} catch (error) {
			log.error({ error, userId }, "Error discovering devices");
		}
	}

	private async refreshDeviceStatus(
		userId: string,
		deviceId: string,
	): Promise<void> {
		const creds = this.credentials.get(userId);
		const state = this.deviceStates.get(`${userId}:${deviceId}`);
		if (!creds || !state || !creds.rriot?.r?.a) return;

		try {
			// Re-fetch home data to get updated device status
			const iotApiUrl = creds.rriot.r.a.startsWith("http")
				? creds.rriot.r.a
				: `https://${creds.rriot.r.a}`;
			const devicesPath = `/user/homes/${creds.homeId}`;
			const hawkAuth = this.getHawkAuthentication(creds.rriot, devicesPath);

			const response = await fetch(`${iotApiUrl}${devicesPath}`, {
				method: "GET",
				headers: { Authorization: hawkAuth },
			});

			if (!response.ok) {
				return;
			}

			const data = (await response.json()) as IoTApiResponse<HomeData>;
			if (!data.success || !data.result) return;

			const device = data.result.devices?.find((d) => d.duid === deviceId);
			if (!device) return;

			// Parse device_status
			const deviceStatus: DeviceStatus = device.deviceStatus || {};
			const dpsState = deviceStatus[DPS_KEYS.STATE];
			const dpsBattery = deviceStatus[DPS_KEYS.BATTERY];

			// Update status based on online and DPS state
			state.status = determineDeviceStatus(device.online, dpsState);

			if (typeof dpsBattery === "number") {
				state.battery = dpsBattery;
			}

			this.emit("statusUpdate", { userId, deviceId, state });

			const dbDevice = deviceQueries.findByType
				.all(userId, "roborock")
				.find((d) => d.device_id === deviceId);
			if (dbDevice) deviceQueries.updateStatus.run(state.status, dbDevice.id);
		} catch (error) {
			log.error({ error, deviceId }, "Error refreshing device status");
		}
	}

	private startPolling(userId: string): void {
		this.stopPolling(userId);
		const interval = setInterval(async () => {
			for (const key of this.deviceStates.keys()) {
				if (key.startsWith(`${userId}:`)) {
					await this.refreshDeviceStatus(userId, key.split(":")[1]);
				}
			}
		}, 30000);
		this.pollingIntervals.set(userId, interval);
	}

	private stopPolling(userId: string): void {
		const interval = this.pollingIntervals.get(userId);
		if (interval) {
			clearInterval(interval);
			this.pollingIntervals.delete(userId);
		}
	}

	async getDevices(userId: string): Promise<RoborockDeviceState[]> {
		const prefix = `${userId}:`;
		return Array.from(this.deviceStates.entries())
			.filter(([key]) => key.startsWith(prefix))
			.map(([, state]) => state);
	}

	/**

	/**
	 * Start the Python daemon if not already running.
	 */
	private async ensureDaemonRunning(): Promise<boolean> {
		if (this.daemonReady) {
			// Verify daemon is still responding
			try {
				const resp = await fetch(`${DAEMON_URL}/health`, { signal: AbortSignal.timeout(2000) });
				if (resp.ok) return true;
			} catch {
				// Daemon not responding, restart it
				log.warn("Daemon not responding, restarting...");
				this.daemonReady = false;
				this.daemonInitializedUsers.clear();
			}
		}

		if (this.daemonProcess) {
			this.daemonProcess.kill();
			this.daemonProcess = null;
		}

		const scriptPath = join(__dirname, "..", "..", "scripts", "roborock_daemon.py");
		const venvPython = join(__dirname, "..", "..", ".venv", "bin", "python");

		log.info({ scriptPath }, "Starting Python daemon");

		this.daemonProcess = spawn(venvPython, [scriptPath, "--port", String(DAEMON_PORT)], {
			stdio: ["ignore", "pipe", "pipe"],
			detached: false,
		});

		this.daemonProcess.stderr?.on("data", (data) => {
			const msg = data.toString().trim();
			if (msg) log.info({ daemon: msg }, "Python daemon");
		});

		this.daemonProcess.on("exit", (code) => {
			log.warn({ code }, "Python daemon exited");
			this.daemonReady = false;
			this.daemonInitializedUsers.clear();
			this.daemonProcess = null;
		});

		// Wait for daemon to be ready
		for (let i = 0; i < 30; i++) {
			await new Promise((r) => setTimeout(r, 100));
			try {
				const resp = await fetch(`${DAEMON_URL}/health`, { signal: AbortSignal.timeout(1000) });
				if (resp.ok) {
					this.daemonReady = true;
					log.info("Python daemon is ready");
					return true;
				}
			} catch {
				// Keep waiting
			}
		}

		log.error("Failed to start Python daemon");
		return false;
	}

	/**
	 * Initialize daemon session for a user.
	 */
	private async initDaemonSession(userId: string): Promise<boolean> {
		const creds = this.credentials.get(userId);
		if (!creds?.rriot) {
			log.warn({ userId }, "No rriot credentials for daemon init");
			return false;
		}

		if (this.daemonInitializedUsers.has(userId)) {
			return true;
		}

		if (!(await this.ensureDaemonRunning())) {
			return false;
		}

		try {
			const resp = await fetch(`${DAEMON_URL}/init`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ user_id: userId, rriot: creds.rriot }),
				signal: AbortSignal.timeout(10000),
			});

			const result = await resp.json() as { success: boolean; error?: string };
			if (result.success) {
				this.daemonInitializedUsers.add(userId);
				log.info({ userId }, "Daemon session initialized");
				return true;
			}
			log.error({ userId, error: result.error }, "Failed to init daemon session");
			return false;
		} catch (err) {
			log.error({ err, userId }, "Error initializing daemon session");
			return false;
		}
	}

	/**
	 * Send command via the persistent Python daemon.
	 */
	private async callDaemon(
		userId: string,
		deviceId: string,
		localKey: string,
		command: string,
		params?: RoborockCommandParam[],
	): Promise<{ success: boolean; result?: unknown; error?: string; status?: RoborockMqttStatus }> {
		if (!(await this.initDaemonSession(userId))) {
			return { success: false, error: "Failed to initialize daemon session" };
		}

		try {
			const resp = await fetch(`${DAEMON_URL}/command`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					user_id: userId,
					device_id: deviceId,
					local_key: localKey,
					command,
					params: params && params.length > 0 ? params : undefined,
				}),
				signal: AbortSignal.timeout(35000), // 35s timeout (daemon has 30s internal)
			});

			return await resp.json() as { success: boolean; result?: unknown; error?: string; status?: RoborockMqttStatus };
		} catch (err) {
			log.error({ err, deviceId, command }, "Error calling daemon");
			return { success: false, error: err instanceof Error ? err.message : "Daemon call failed" };
		}
	}

	/**
	 * Disconnect user from daemon.
	 */
	private async disconnectDaemonSession(userId: string): Promise<void> {
		if (!this.daemonInitializedUsers.has(userId)) return;

		try {
			await fetch(`${DAEMON_URL}/disconnect`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ user_id: userId }),
				signal: AbortSignal.timeout(5000),
			});
			this.daemonInitializedUsers.delete(userId);
		} catch (err) {
			log.warn({ err, userId }, "Error disconnecting daemon session");
		}
	}

	/**
	 * Send a command to a Roborock device using persistent Python daemon.
	 */
	async sendCommand(
		userId: string,
		deviceId: string,
		command: string,
		params: RoborockCommandParam[] = [],
	): Promise<CommandResult> {
		const creds = this.credentials.get(userId);
		if (!creds) {
			const error = "No credentials found for user";
			log.warn(
				{ userId, deviceId, command },
				"Cannot send command: no credentials",
			);
			return {
				success: false,
				error,
				errorCategory: "missing_credentials",
			};
		}

		if (!creds.rriot) {
			const error = "No IoT credentials available - please re-authenticate";
			log.error({ userId }, "No rriot credentials for Python daemon");
			return {
				success: false,
				error,
				errorCategory: "auth_expired",
			};
		}

		// Get localKey for the device
		const localKey = this.deviceLocalKeys.get(deviceId);
		if (!localKey) {
			const error = "Device not found or missing encryption key";
			log.error({ deviceId }, "No localKey for device");
			return {
				success: false,
				error,
				errorCategory: "unknown",
			};
		}

		try {
			// Use persistent daemon for improved performance
			const result = await this.callDaemon(
				userId,
				deviceId,
				localKey,
				command,
				params.length > 0 ? params : undefined,
			);

			if (result.success) {
				log.info({ deviceId, command, result: result.result }, "Command success");
				return { success: true };
			}

			const error = result.error || "Command failed";
			log.error({ deviceId, command, error }, "Command failed");
			return {
				success: false,
				error,
				errorCategory: categorizeError(error),
			};
		} catch (err) {
			const error =
				err instanceof Error ? err.message : "Failed to communicate with device";
			log.error({ err, deviceId, command }, "Failed to send command via Python daemon");
			return {
				success: false,
				error,
				errorCategory: categorizeError(error),
			};
		}
	}

	startCleaning(userId: string, deviceId: string): Promise<CommandResult> {
		return this.sendCommand(userId, deviceId, "app_start");
	}

	stopCleaning(userId: string, deviceId: string): Promise<CommandResult> {
		return this.sendCommand(userId, deviceId, "app_stop");
	}

	pauseCleaning(userId: string, deviceId: string): Promise<CommandResult> {
		return this.sendCommand(userId, deviceId, "app_pause");
	}

	returnHome(userId: string, deviceId: string): Promise<CommandResult> {
		return this.sendCommand(userId, deviceId, "app_charge");
	}

	findRobot(userId: string, deviceId: string): Promise<CommandResult> {
		return this.sendCommand(userId, deviceId, "find_me");
	}

	/**
	 * Get device status via Python daemon (MQTT).
	 * Returns real-time status data from the device.
	 */
	async getDeviceStatusViaMqtt(
		userId: string,
		deviceId: string,
	): Promise<{ success: boolean; status?: RoborockMqttStatus; error?: string }> {
		const creds = this.credentials.get(userId);
		if (!creds?.rriot) {
			return { success: false, error: "No credentials" };
		}

		const localKey = this.deviceLocalKeys.get(deviceId);
		if (!localKey) {
			return { success: false, error: "Device not found" };
		}

		try {
			const result = await this.callDaemon(
				userId,
				deviceId,
				localKey,
				"get_status",
			);

			if (result.success && result.status) {
				return {
					success: true,
					status: result.status,
				};
			}

			return { success: false, error: result.error || "Failed to get status" };
		} catch (err) {
			log.error({ err, deviceId }, "Failed to get status via MQTT");
			return {
				success: false,
				error: err instanceof Error ? err.message : "Unknown error",
			};
		}
	}

	setFanSpeed(
		userId: string,
		deviceId: string,
		speed: RoborockDeviceState["fanSpeed"],
	): Promise<CommandResult> {
		const map = { quiet: 101, balanced: 102, turbo: 103, max: 104 };
		return this.sendCommand(userId, deviceId, "set_custom_mode", [map[speed]]);
	}

	setWaterLevel(
		userId: string,
		deviceId: string,
		level: RoborockDeviceState["waterLevel"],
	): Promise<CommandResult> {
		const map = { off: 200, low: 201, medium: 202, high: 203 };
		return this.sendCommand(userId, deviceId, "set_water_box_custom_mode", [
			map[level],
		]);
	}

	cleanRooms(
		userId: string,
		deviceId: string,
		roomIds: number[],
	): Promise<CommandResult> {
		return this.sendCommand(userId, deviceId, "app_segment_clean", [
			{ segments: roomIds, repeat: 1 },
		]);
	}

	async getMap(): Promise<null> {
		return null;
	}

	/**
	 * Get cleaning history for a device.
	 * NOTE: This requires MQTT implementation which is not yet available.
	 */
	async getCleanHistory(
		_userId: string,
		_deviceId: string,
	): Promise<CleanHistoryRecord[]> {
		// TODO: Implement via MQTT - REST endpoint does not exist
		log.warn("getCleanHistory not yet implemented - requires MQTT");
		return [];
	}

	isConnected(userId: string): boolean {
		return this.credentials.has(userId);
	}

	async disconnect(userId: string): Promise<void> {
		this.stopPolling(userId);
		await this.disconnectDaemonSession(userId);
		this.credentials.delete(userId);
		for (const key of this.deviceStates.keys()) {
			if (key.startsWith(`${userId}:`)) {
				const deviceId = key.split(":")[1];
				this.deviceLocalKeys.delete(deviceId);
				this.deviceStates.delete(key);
			}
		}
	}

	getDeviceState(deviceId: string): RoborockDeviceState | undefined {
		for (const state of this.deviceStates.values()) {
			if (state.id === deviceId) return state;
		}
		return undefined;
	}

	async shutdown(): Promise<void> {
		for (const userId of this.pollingIntervals.keys()) this.stopPolling(userId);
		// Shutdown daemon
		if (this.daemonProcess) {
			try {
				await fetch(`${DAEMON_URL}/shutdown`, {
					method: "POST",
					signal: AbortSignal.timeout(5000),
				});
			} catch {
				// Ignore errors during shutdown
			}
			this.daemonProcess.kill();
			this.daemonProcess = null;
		}
		this.daemonReady = false;
		this.daemonInitializedUsers.clear();
		this.deviceLocalKeys.clear();
		this.credentials.clear();
		this.deviceStates.clear();
	}
}

export const roborockService = new RoborockService();

export function getRoborockLiveState(
	deviceId: string,
): RoborockDeviceState | undefined {
	return roborockService.getDeviceState(deviceId);
}
