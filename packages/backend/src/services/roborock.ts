import crypto from "node:crypto";
import { EventEmitter } from "node:events";
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

const ROBOROCK_API = "https://usiot.roborock.com";

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

	private md5(input: string): string {
		return crypto.createHash("md5").update(input).digest("hex");
	}

	async authenticate(
		userId: string,
		email: string,
		password: string,
	): Promise<{ success: boolean; error?: string }> {
		try {
			const response = await fetch(`${ROBOROCK_API}/api/v1/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username: email,
					password: this.md5(password),
					needtwostepauth: false,
				}),
			});

			const data = await response.json();
			if (data.code !== 200 && data.status !== "ok") {
				return { success: false, error: data.msg || "Authentication failed" };
			}

			const token = data.data?.token || data.token;
			if (!token) {
				return { success: false, error: "No token received" };
			}

			const creds: RoborockCredentials = {
				token,
				userId: data.data?.userid || data.userid,
				homeId: data.data?.homeid || data.homeid,
			};

			saveCredentials(
				userId,
				"roborock",
				encrypt(JSON.stringify(creds), config.ENCRYPTION_SECRET),
			);
			this.credentials.set(userId, creds);
			await this.discoverDevices(userId);
			this.startPolling(userId);

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Authentication failed",
			};
		}
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
		if (!creds) return;

		try {
			const response = await fetch(`${ROBOROCK_API}/api/v1/getHomeDetail`, {
				headers: { Authorization: `Bearer ${creds.token}` },
			});

			const data = await response.json();
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
		} catch {}
	}

	private async refreshDeviceStatus(
		userId: string,
		deviceId: string,
	): Promise<void> {
		const creds = this.credentials.get(userId);
		const state = this.deviceStates.get(`${userId}:${deviceId}`);
		if (!creds || !state) return;

		try {
			const response = await fetch(
				`${ROBOROCK_API}/api/v1/user/devices/${deviceId}/status`,
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

		try {
			const response = await fetch(
				`${ROBOROCK_API}/api/v1/user/devices/${deviceId}/command`,
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
		try {
			const response = await fetch(
				`${ROBOROCK_API}/api/v1/user/devices/${deviceId}/clean_summary`,
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
