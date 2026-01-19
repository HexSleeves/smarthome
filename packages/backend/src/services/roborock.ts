import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import pino from "pino";
import { config } from "../config.js";
import {
	createDevice,
	createEvent,
	deviceQueries,
	getCredentials,
	saveCredentials,
} from "../db/queries.js";
import { decrypt, encrypt } from "../lib/crypto.js";
import type { RoborockCommandParam } from "../types.js";

const log = pino({ name: "roborock" });

// Roborock API endpoints
const API_V3_SIGN = "api/v3/key/sign";
const API_V4_LOGIN_PASSWORD = "api/v4/auth/email/login/pwd";
const API_V4_EMAIL_CODE_SEND = "api/v4/email/code/send";
const API_V4_LOGIN_CODE = "api/v4/auth/email/login/code";

const DEFAULT_HEADERS = {
	header_appversion: "4.54.02",
	header_clientlang: "en",
	header_phonemodel: "Pixel 7",
	header_phonesystem: "Android",
};

function getRegionFromEmail(_email: string): {
	baseURL: string;
	country: string;
	countryCode: string;
} {
	// Simple region detection - default to US
	return { baseURL: "usiot.roborock.com", country: "US", countryCode: "1" };
}

interface RoborockCredentials {
	token: string;
	userId: string;
	homeId: string;
	rruid?: string;
	baseURL: string;
}

interface PendingAuth {
	email: string;
	baseURL: string;
	clientId: string;
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

const STATUS_MAP: Record<number, RoborockDeviceState["status"]> = {
	1: "idle",
	2: "idle",
	3: "idle",
	5: "cleaning",
	6: "returning",
	7: "cleaning",
	8: "charging",
	9: "charging",
	10: "paused",
	11: "cleaning",
	12: "error",
	13: "error",
	14: "idle",
	15: "returning",
	16: "cleaning",
	17: "cleaning",
	18: "cleaning",
	100: "charging",
};

const FAN_MAP: Record<number, RoborockDeviceState["fanSpeed"]> = {
	101: "quiet",
	102: "balanced",
	103: "turbo",
	104: "max",
	105: "quiet",
	106: "quiet",
};

const WATER_MAP: Record<number, RoborockDeviceState["waterLevel"]> = {
	200: "off",
	201: "low",
	202: "medium",
	203: "high",
};

const ERROR_MSG: Record<number, string> = {
	0: "No error",
	1: "Laser sensor fault",
	2: "Collision sensor fault",
	3: "Wheel floating",
	4: "Cliff sensor fault",
	5: "Main brush jammed",
	6: "Side brush jammed",
	7: "Wheel jammed",
	8: "Device stuck",
	9: "Dust bin missing",
	10: "Filter clogged",
	11: "Magnetic field detected",
	12: "Low battery",
	13: "Charging problem",
	14: "Battery failure",
};

class RoborockService extends EventEmitter {
	private readonly credentials = new Map<string, RoborockCredentials>();
	private readonly deviceStates = new Map<string, RoborockDeviceState>();
	private readonly pollingIntervals = new Map<string, NodeJS.Timeout>();
	private readonly pendingAuth = new Map<string, PendingAuth>();

	private generateClientId(email: string): string {
		return crypto
			.createHash("md5")
			.update(email)
			.update(crypto.randomUUID())
			.digest()
			.toString("base64");
	}

	private generateNonce(): string {
		return crypto
			.randomBytes(12)
			.toString("base64")
			.substring(0, 16)
			.replace(/\+/g, "X")
			.replace(/\//g, "Y");
	}

	private encryptPassword(password: string, k: string): string {
		const derivedKey = k.slice(4) + k.slice(0, 4);
		const cipher = crypto.createCipheriv(
			"aes-128-ecb",
			Buffer.from(derivedKey, "utf-8"),
			null,
		);
		cipher.setAutoPadding(true);
		let encrypted = cipher.update(password, "utf8", "base64");
		encrypted += cipher.final("base64");
		return encrypted;
	}

	private getHeaders(email: string, clientId: string): Record<string, string> {
		return {
			header_clientid: crypto
				.createHash("md5")
				.update(email)
				.update(clientId)
				.digest()
				.toString("base64"),
			header_clientlang: DEFAULT_HEADERS.header_clientlang,
			header_appversion: DEFAULT_HEADERS.header_appversion,
			header_phonemodel: DEFAULT_HEADERS.header_phonemodel,
			header_phonesystem: DEFAULT_HEADERS.header_phonesystem,
			"Content-Type": "application/x-www-form-urlencoded",
		};
	}

	async authenticate(
		userId: string,
		email: string,
		password: string,
	): Promise<{
		success: boolean;
		error?: string;
		twoFactorRequired?: boolean;
	}> {
		log.info({ userId, email }, "Roborock authentication attempt");
		try {
			const region = getRegionFromEmail(email);
			const baseURL = `https://${region.baseURL}`;
			const clientId = this.generateClientId(email);
			const nonce = this.generateNonce();

			// Step 1: Get signing key
			log.info({ baseURL, nonce }, "Getting signing key");
			const signResponse = await fetch(`${baseURL}/${API_V3_SIGN}?s=${nonce}`, {
				method: "POST",
				headers: this.getHeaders(email, clientId),
			});
			const signData = await signResponse.json();
			log.info({ signData }, "Sign response");

			if (!signData?.data?.k) {
				log.error({ signData }, "Failed to get signing key");
				return { success: false, error: "Failed to get signing key" };
			}

			const k = signData.data.k;

			// Step 2: Login with password
			log.info("Attempting password login");
			const encryptedPassword = this.encryptPassword(password, k);

			const loginParams = new URLSearchParams({
				email,
				password: encryptedPassword,
				majorVersion: "14",
				minorVersion: "0",
			});

			const loginResponse = await fetch(`${baseURL}/${API_V4_LOGIN_PASSWORD}`, {
				method: "POST",
				headers: {
					...this.getHeaders(email, clientId),
					"x-mercy-k": k,
					"x-mercy-ks": nonce,
				},
				body: loginParams.toString(),
			});

			const loginData = await loginResponse.json();
			log.info(
				{ code: loginData.code, msg: loginData.msg, hasData: !!loginData.data },
				"Login response",
			);

			// Check for 2FA requirement
			if (loginData.code === 2031) {
				log.info({ userId }, "Two-factor authentication required");
				this.pendingAuth.set(userId, {
					email,
					baseURL: region.baseURL,
					clientId,
				});
				return {
					success: false,
					twoFactorRequired: true,
					error: "Two-factor authentication required",
				};
			}

			if (loginData.code !== 200 || !loginData.data) {
				log.warn(
					{ code: loginData.code, msg: loginData.msg },
					"Roborock authentication failed",
				);
				return {
					success: false,
					error: loginData.msg || "Authentication failed",
				};
			}

			return this.completeLogin(userId, loginData.data, region.baseURL);
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
		log.info({ userId, email }, "Sending 2FA code");
		try {
			const region = getRegionFromEmail(email);
			const baseURL = `https://${region.baseURL}`;
			const clientId = this.generateClientId(email);

			const params = new URLSearchParams({
				type: "login",
				email,
				platform: "",
			});

			const response = await fetch(`${baseURL}/${API_V4_EMAIL_CODE_SEND}`, {
				method: "POST",
				headers: this.getHeaders(email, clientId),
				body: params.toString(),
			});

			const data = await response.json();
			log.info({ code: data.code, msg: data.msg }, "Send 2FA code response");

			if (data.code !== 200) {
				return { success: false, error: data.msg || "Failed to send code" };
			}

			// Store pending auth info
			this.pendingAuth.set(userId, {
				email,
				baseURL: region.baseURL,
				clientId,
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
		log.info({ userId }, "Verifying 2FA code");
		try {
			const pending = this.pendingAuth.get(userId);
			if (!pending) {
				return {
					success: false,
					error: "No pending authentication. Please start login again.",
				};
			}

			const { email, baseURL, clientId } = pending;
			const fullBaseURL = `https://${baseURL}`;
			const nonce = this.generateNonce();

			// Get signing key
			const signResponse = await fetch(
				`${fullBaseURL}/${API_V3_SIGN}?s=${nonce}`,
				{
					method: "POST",
					headers: this.getHeaders(email, clientId),
				},
			);
			const signData = await signResponse.json();

			if (!signData?.data?.k) {
				return { success: false, error: "Failed to get signing key" };
			}

			const k = signData.data.k;
			const region = getRegionFromEmail(email);

			const params = new URLSearchParams({
				country: region.country,
				countryCode: region.countryCode,
				email,
				code,
				majorVersion: "14",
				minorVersion: "0",
			});

			const loginResponse = await fetch(`${fullBaseURL}/${API_V4_LOGIN_CODE}`, {
				method: "POST",
				headers: {
					...this.getHeaders(email, clientId),
					"x-mercy-k": k,
					"x-mercy-ks": nonce,
				},
				body: params.toString(),
			});

			const loginData = await loginResponse.json();
			log.info(
				{ code: loginData.code, msg: loginData.msg },
				"2FA login response",
			);

			if (loginData.code !== 200 || !loginData.data) {
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
		data: { token: string; userid: string; rruid?: string },
		baseURL: string,
	): Promise<{ success: boolean; error?: string }> {
		const creds: RoborockCredentials = {
			token: data.token,
			userId: data.userid,
			homeId: "", // Will be populated from home detail
			rruid: data.rruid,
			baseURL,
		};
		log.info(
			{ roborockUserId: creds.userId, rruid: creds.rruid },
			"Roborock credentials obtained",
		);

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
			if (!stored) return false;

			const creds = JSON.parse(
				decrypt(stored.credentials_encrypted, config.ENCRYPTION_SECRET),
			) as RoborockCredentials;

			this.credentials.set(userId, creds);
			await this.discoverDevices(userId);
			this.startPolling(userId);
			return true;
		} catch {
			return false;
		}
	}

	private async discoverDevices(userId: string): Promise<void> {
		const creds = this.credentials.get(userId);
		if (!creds) {
			log.warn({ userId }, "discoverDevices: No credentials found");
			return;
		}

		const baseURL = `https://${creds.baseURL || "usiot.roborock.com"}`;
		log.info({ userId, baseURL }, "Discovering Roborock devices");
		try {
			const response = await fetch(`${baseURL}/api/v1/getHomeDetail`, {
				headers: { Authorization: `Bearer ${creds.token}` },
			});

			const data = await response.json();
			log.info(
				{ status: response.status, data },
				"Roborock getHomeDetail response",
			);
			const devices = data.result?.devices || data.data?.devices || [];

			for (const device of devices) {
				const key = `${userId}:${device.duid}`;
				const existing = deviceQueries.findByType
					.all(userId, "roborock")
					.find((d) => d.device_id === device.duid);

				if (!existing) {
					createDevice(
						userId,
						"roborock",
						device.name || "Roborock Vacuum",
						device.duid,
						{
							model: device.model,
							fwVersion: device.fv,
						},
					);
				}

				this.deviceStates.set(key, {
					id: device.duid,
					name: device.name || "Roborock Vacuum",
					model: device.model || "Unknown",
					status: "offline",
					battery: 0,
					fanSpeed: "balanced",
					waterLevel: "medium",
					cleanArea: 0,
					cleanTime: 0,
					errorCode: 0,
					errorMessage: null,
					lastClean: null,
				});

				await this.refreshDeviceStatus(userId, device.duid);
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
		if (!creds || !state) return;

		const baseURL = `https://${creds.baseURL || "usiot.roborock.com"}`;
		try {
			const response = await fetch(
				`${baseURL}/api/v1/user/devices/${deviceId}/status`,
				{
					headers: { Authorization: `Bearer ${creds.token}` },
				},
			);

			if (!response.ok) {
				state.status = "offline";
				return;
			}

			const data = await response.json();
			const s = data.result || data.data || {};

			state.status = STATUS_MAP[s.state] || "idle";
			state.battery = s.battery || 0;
			state.fanSpeed = FAN_MAP[s.fan_power] || "balanced";
			state.waterLevel = WATER_MAP[s.water_box_mode] || "medium";
			state.cleanArea = (s.clean_area || 0) / 1000000;
			state.cleanTime = Math.floor((s.clean_time || 0) / 60);
			state.errorCode = s.error_code || 0;
			state.errorMessage = state.errorCode
				? ERROR_MSG[state.errorCode] || "Unknown error"
				: null;

			this.emit("statusUpdate", { userId, deviceId, state });

			const device = deviceQueries.findByType
				.all(userId, "roborock")
				.find((d) => d.device_id === deviceId);
			if (device) deviceQueries.updateStatus.run(state.status, device.id);
		} catch {
			state.status = "offline";
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

	async sendCommand(
		userId: string,
		deviceId: string,
		command: string,
		params: RoborockCommandParam[] = [],
	): Promise<boolean> {
		const creds = this.credentials.get(userId);
		if (!creds) return false;

		const baseURL = `https://${creds.baseURL || "usiot.roborock.com"}`;
		try {
			const response = await fetch(
				`${baseURL}/api/v1/user/devices/${deviceId}/command`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${creds.token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ method: command, params }),
				},
			);

			const data = await response.json();
			if (data.code === 200 || data.result === "ok") {
				const device = deviceQueries.findByType
					.all(userId, "roborock")
					.find((d) => d.device_id === deviceId);
				if (device) createEvent(device.id, "command", { command, params });
				setTimeout(() => this.refreshDeviceStatus(userId, deviceId), 2000);
				return true;
			}
			return false;
		} catch {
			return false;
		}
	}

	startCleaning(userId: string, deviceId: string) {
		return this.sendCommand(userId, deviceId, "app_start");
	}
	stopCleaning(userId: string, deviceId: string) {
		return this.sendCommand(userId, deviceId, "app_stop");
	}
	pauseCleaning(userId: string, deviceId: string) {
		return this.sendCommand(userId, deviceId, "app_pause");
	}
	returnHome(userId: string, deviceId: string) {
		return this.sendCommand(userId, deviceId, "app_charge");
	}
	findRobot(userId: string, deviceId: string) {
		return this.sendCommand(userId, deviceId, "find_me");
	}

	setFanSpeed(
		userId: string,
		deviceId: string,
		speed: RoborockDeviceState["fanSpeed"],
	) {
		const map = { quiet: 101, balanced: 102, turbo: 103, max: 104 };
		return this.sendCommand(userId, deviceId, "set_custom_mode", [map[speed]]);
	}

	setWaterLevel(
		userId: string,
		deviceId: string,
		level: RoborockDeviceState["waterLevel"],
	) {
		const map = { off: 200, low: 201, medium: 202, high: 203 };
		return this.sendCommand(userId, deviceId, "set_water_box_custom_mode", [
			map[level],
		]);
	}

	cleanRooms(userId: string, deviceId: string, roomIds: number[]) {
		return this.sendCommand(userId, deviceId, "app_segment_clean", [
			{ segments: roomIds, repeat: 1 },
		]);
	}

	async getMap(): Promise<null> {
		return null;
	}

	async getCleanHistory(userId: string, deviceId: string): Promise<unknown[]> {
		const creds = this.credentials.get(userId);
		if (!creds) return [];
		const baseURL = `https://${creds.baseURL || "usiot.roborock.com"}`;
		try {
			const response = await fetch(
				`${baseURL}/api/v1/user/devices/${deviceId}/clean_summary`,
				{
					headers: { Authorization: `Bearer ${creds.token}` },
				},
			);
			const data = await response.json();
			return data.result?.records || [];
		} catch {
			return [];
		}
	}

	isConnected(userId: string): boolean {
		return this.credentials.has(userId);
	}

	disconnect(userId: string): void {
		this.stopPolling(userId);
		this.credentials.delete(userId);
		for (const key of this.deviceStates.keys()) {
			if (key.startsWith(`${userId}:`)) this.deviceStates.delete(key);
		}
	}

	getDeviceState(deviceId: string): RoborockDeviceState | undefined {
		for (const state of this.deviceStates.values()) {
			if (state.id === deviceId) return state;
		}
		return undefined;
	}

	shutdown(): void {
		for (const userId of this.pollingIntervals.keys()) this.stopPolling(userId);
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
