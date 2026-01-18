import { EventEmitter } from "node:events";
import { decrypt, encrypt } from "../lib/crypto.js";
import {
	saveCredentials,
	getCredentials,
	createDevice,
	deviceQueries,
	createEvent,
} from "../db/queries.js";
import crypto from "node:crypto";

import { config } from "../config.js";

const ENCRYPTION_SECRET = config.ENCRYPTION_SECRET;

// Roborock Cloud API endpoints
const ROBOROCK_API_BASE = "https://usiot.roborock.com";
const ROBOROCK_LOGIN_URL = `${ROBOROCK_API_BASE}/api/v1/login`;
const ROBOROCK_DEVICES_URL = `${ROBOROCK_API_BASE}/api/v1/getHomeDetail`;

interface RoborockCredentials {
	token: string;
	userId: string;
	homeId: string;
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
	cleanArea: number; // square meters
	cleanTime: number; // minutes
	errorCode: number;
	errorMessage: string | null;
	lastClean: string | null;
}

// Status code mapping
const STATUS_MAP: Record<number, RoborockDeviceState["status"]> = {
	1: "idle",
	2: "idle",
	3: "idle",
	5: "cleaning",
	6: "returning",
	7: "cleaning", // manual mode
	8: "charging",
	9: "charging", // charging problem
	10: "paused",
	11: "cleaning", // spot cleaning
	12: "error",
	13: "error", // shutting down
	14: "idle", // updating
	15: "returning", // docking
	16: "cleaning", // goto
	17: "cleaning", // zone cleaning
	18: "cleaning", // room cleaning
	100: "charging", // full
};

const FAN_SPEED_MAP: Record<number, RoborockDeviceState["fanSpeed"]> = {
	101: "quiet",
	102: "balanced",
	103: "turbo",
	104: "max",
	105: "quiet", // custom
	106: "quiet", // mop
};

const WATER_LEVEL_MAP: Record<number, RoborockDeviceState["waterLevel"]> = {
	200: "off",
	201: "low",
	202: "medium",
	203: "high",
};

const ERROR_MESSAGES: Record<number, string> = {
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
	15: "Wall sensor fault",
	16: "Uneven surface",
	17: "Side brush failure",
	18: "Suction fan failure",
	19: "Unpowered charging station",
	20: "Unknown error",
	21: "Laser pressure sensor fault",
	22: "Charge sensor fault",
	23: "Dock problem",
	24: "No-go zone detected",
};

class RoborockService extends EventEmitter {
	private readonly credentials: Map<string, RoborockCredentials> = new Map();
	private readonly deviceStates: Map<string, RoborockDeviceState> = new Map();
	private readonly pollingIntervals: Map<string, NodeJS.Timeout> = new Map();

	private md5(input: string): string {
		return crypto.createHash("md5").update(input).digest("hex");
	}

	async authenticate(
		userId: string,
		email: string,
		password: string,
	): Promise<{ success: boolean; error?: string }> {
		try {
			// Roborock uses MD5 hashed password
			const hashedPassword = this.md5(password);

			const response = await fetch(ROBOROCK_LOGIN_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify({
					username: email,
					password: hashedPassword,
					needtwostepauth: false,
				}),
			});

			const data = await response.json();

			if (data.code !== 200 && data.status !== "ok") {
				return { success: false, error: data.msg || "Authentication failed" };
			}

			const token = data.data?.token || data.token;
			const rrUserId = data.data?.userid || data.userid;
			const homeId = data.data?.homeid || data.homeid;

			if (!token) {
				return { success: false, error: "No token received" };
			}

			const creds: RoborockCredentials = { token, userId: rrUserId, homeId };

			// Save encrypted credentials
			const encrypted = encrypt(JSON.stringify(creds), ENCRYPTION_SECRET);
			saveCredentials(userId, "roborock", encrypted);

			this.credentials.set(userId, creds);

			// Discover devices
			await this.discoverDevices(userId);

			// Start polling for status
			this.startPolling(userId);

			return { success: true };
		} catch (error: any) {
			console.error("Roborock auth error:", error);
			return {
				success: false,
				error: error.message || "Authentication failed",
			};
		}
	}

	async connectWithStoredCredentials(userId: string): Promise<boolean> {
		try {
			const stored = getCredentials(userId, "roborock");
			if (!stored) return false;

			const creds = JSON.parse(
				decrypt(stored.credentials_encrypted, ENCRYPTION_SECRET),
			) as RoborockCredentials;
			this.credentials.set(userId, creds);

			// Verify connection and discover devices
			await this.discoverDevices(userId);
			this.startPolling(userId);

			return true;
		} catch (error) {
			console.error("Roborock reconnect error:", error);
			return false;
		}
	}

	private async discoverDevices(userId: string): Promise<void> {
		const creds = this.credentials.get(userId);
		if (!creds) return;

		try {
			const response = await fetch(ROBOROCK_DEVICES_URL, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${creds.token}`,
					Accept: "application/json",
				},
			});

			const data = await response.json();

			if (data.code !== 200 && !data.result) {
				console.error("Failed to get devices:", data);
				return;
			}

			const devices = data.result?.devices || data.data?.devices || [];

			for (const device of devices) {
				const deviceKey = `${userId}:${device.duid}`;

				// Check if device exists in DB
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

				// Initialize state
				const state: RoborockDeviceState = {
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
				};

				this.deviceStates.set(deviceKey, state);

				// Fetch initial status
				await this.refreshDeviceStatus(userId, device.duid);
			}
		} catch (error) {
			console.error("Failed to discover devices:", error);
		}
	}

	private async refreshDeviceStatus(
		userId: string,
		deviceId: string,
	): Promise<void> {
		const creds = this.credentials.get(userId);
		if (!creds) return;

		const deviceKey = `${userId}:${deviceId}`;
		const state = this.deviceStates.get(deviceKey);
		if (!state) return;

		try {
			// Note: Actual Roborock API requires more complex RPC calls
			// This is a simplified representation
			const response = await fetch(
				`${ROBOROCK_API_BASE}/api/v1/user/devices/${deviceId}/status`,
				{
					headers: {
						Authorization: `Bearer ${creds.token}`,
						Accept: "application/json",
					},
				},
			);

			if (!response.ok) {
				state.status = "offline";
				return;
			}

			const data = await response.json();
			const status = data.result || data.data || {};

			// Update state based on response
			state.status = STATUS_MAP[status.state] || "idle";
			state.battery = status.battery || 0;
			state.fanSpeed = FAN_SPEED_MAP[status.fan_power] || "balanced";
			state.waterLevel = WATER_LEVEL_MAP[status.water_box_mode] || "medium";
			state.cleanArea = (status.clean_area || 0) / 1000000; // mm² to m²
			state.cleanTime = Math.floor((status.clean_time || 0) / 60); // seconds to minutes
			state.errorCode = status.error_code || 0;
			state.errorMessage = state.errorCode
				? ERROR_MESSAGES[state.errorCode] || "Unknown error"
				: null;

			// Emit status update
			this.emit("statusUpdate", { userId, deviceId, state });

			// Update DB
			const device = deviceQueries.findByType
				.all(userId, "roborock")
				.find((d) => d.device_id === deviceId);
			if (device) {
				deviceQueries.updateStatus.run(state.status, device.id);
			}
		} catch (error) {
			console.error("Failed to refresh status:", error);
			state.status = "offline";
		}
	}

	private startPolling(userId: string): void {
		// Stop existing polling
		this.stopPolling(userId);

		// Poll every 30 seconds
		const interval = setInterval(async () => {
			for (const [key] of this.deviceStates) {
				if (key.startsWith(`${userId}:`)) {
					const deviceId = key.split(":")[1];
					await this.refreshDeviceStatus(userId, deviceId);
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
		const states: RoborockDeviceState[] = [];

		for (const [key, state] of this.deviceStates) {
			if (key.startsWith(`${userId}:`)) {
				states.push(state);
			}
		}

		return states;
	}

	async sendCommand(
		userId: string,
		deviceId: string,
		command: string,
		params: any[] = [],
	): Promise<boolean> {
		const creds = this.credentials.get(userId);
		if (!creds) return false;

		try {
			const response = await fetch(
				`${ROBOROCK_API_BASE}/api/v1/user/devices/${deviceId}/command`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${creds.token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						method: command,
						params: params,
					}),
				},
			);

			const data = await response.json();

			if (data.code === 200 || data.result === "ok") {
				// Log the command
				const device = deviceQueries.findByType
					.all(userId, "roborock")
					.find((d) => d.device_id === deviceId);
				if (device) {
					createEvent(device.id, "command", { command, params });
				}

				// Refresh status after command
				setTimeout(() => this.refreshDeviceStatus(userId, deviceId), 2000);

				return true;
			}

			return false;
		} catch (error) {
			console.error("Failed to send command:", error);
			return false;
		}
	}

	// Vacuum commands
	async startCleaning(userId: string, deviceId: string): Promise<boolean> {
		return this.sendCommand(userId, deviceId, "app_start");
	}

	async stopCleaning(userId: string, deviceId: string): Promise<boolean> {
		return this.sendCommand(userId, deviceId, "app_stop");
	}

	async pauseCleaning(userId: string, deviceId: string): Promise<boolean> {
		return this.sendCommand(userId, deviceId, "app_pause");
	}

	async returnHome(userId: string, deviceId: string): Promise<boolean> {
		return this.sendCommand(userId, deviceId, "app_charge");
	}

	async setFanSpeed(
		userId: string,
		deviceId: string,
		speed: RoborockDeviceState["fanSpeed"],
	): Promise<boolean> {
		const speedMap: Record<string, number> = {
			quiet: 101,
			balanced: 102,
			turbo: 103,
			max: 104,
		};
		return this.sendCommand(userId, deviceId, "set_custom_mode", [
			speedMap[speed],
		]);
	}

	async setWaterLevel(
		userId: string,
		deviceId: string,
		level: RoborockDeviceState["waterLevel"],
	): Promise<boolean> {
		const levelMap: Record<string, number> = {
			off: 200,
			low: 201,
			medium: 202,
			high: 203,
		};
		return this.sendCommand(userId, deviceId, "set_water_box_custom_mode", [
			levelMap[level],
		]);
	}

	async cleanRooms(
		userId: string,
		deviceId: string,
		roomIds: number[],
	): Promise<boolean> {
		return this.sendCommand(userId, deviceId, "app_segment_clean", [
			{ segments: roomIds, repeat: 1 },
		]);
	}

	async findRobot(userId: string, deviceId: string): Promise<boolean> {
		return this.sendCommand(userId, deviceId, "find_me");
	}

	async getMap(userId: string, deviceId: string): Promise<any> {
		// Map data requires more complex handling
		// For now, return null - would need to implement map decoding
		return null;
	}

	async getCleanHistory(userId: string, deviceId: string): Promise<any[]> {
		const creds = this.credentials.get(userId);
		if (!creds) return [];

		try {
			const response = await fetch(
				`${ROBOROCK_API_BASE}/api/v1/user/devices/${deviceId}/clean_summary`,
				{
					headers: {
						Authorization: `Bearer ${creds.token}`,
						Accept: "application/json",
					},
				},
			);

			const data = await response.json();
			return data.result?.records || [];
		} catch (error) {
			console.error("Failed to get clean history:", error);
			return [];
		}
	}

	isConnected(userId: string): boolean {
		return this.credentials.has(userId);
	}

	disconnect(userId: string): void {
		this.stopPolling(userId);
		this.credentials.delete(userId);

		// Clean up device states for this user
		for (const key of this.deviceStates.keys()) {
			if (key.startsWith(`${userId}:`)) {
				this.deviceStates.delete(key);
			}
		}
	}

	/**
	 * Get device state by device ID (for tRPC router)
	 */
	getDeviceState(deviceId: string): RoborockDeviceState | undefined {
		for (const [, state] of this.deviceStates.entries()) {
			if (state.id === deviceId) {
				return state;
			}
		}
		return undefined;
	}

	/**
	 * Graceful shutdown - stop all polling and clear state
	 */
	shutdown(): void {
		for (const userId of this.pollingIntervals.keys()) {
			this.stopPolling(userId);
		}
		this.credentials.clear();
		this.deviceStates.clear();
	}
}

export const roborockService = new RoborockService();

// Helper for tRPC to get live state
export function getRoborockLiveState(
	deviceId: string,
): RoborockDeviceState | undefined {
	return roborockService.getDeviceState(deviceId);
}
