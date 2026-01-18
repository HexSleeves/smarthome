import { EventEmitter } from "node:events";
import { type CameraEvent, RingApi, type RingCamera } from "ring-client-api";
import { config } from "../config.js";
import {
	createDevice,
	createEvent,
	deviceQueries,
	getCredentials,
	saveCredentials,
} from "../db/queries.js";
import { decrypt, encrypt } from "../lib/crypto.js";
import type { RingEventPayload } from "../types.js";

interface RingCredentials {
	refreshToken: string;
}

interface RingDeviceState {
	id: string;
	name: string;
	type: "doorbell" | "camera" | "chime";
	status: "online" | "offline";
	battery: number | null;
	hasLight: boolean;
	hasSiren: boolean;
	lastMotion: string | null;
	lastDing: string | null;
}

interface Pending2FASession {
	email: string;
	password: string;
	timestamp: number;
}

const TWO_FA_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

class RingService extends EventEmitter {
	private readonly apiInstances = new Map<string, RingApi>();
	private readonly cameras = new Map<string, RingCamera>();
	private readonly deviceStates = new Map<string, RingDeviceState>();
	private readonly pending2FA = new Map<string, Pending2FASession>();

	async authenticate(
		userId: string,
		email: string,
		password: string,
		twoFactorCode?: string,
	): Promise<{
		success: boolean;
		requiresTwoFactor?: boolean;
		prompt?: string;
		error?: string;
	}> {
		let authEmail = email;
		let authPassword = password;

		try {
			if (twoFactorCode && (!email || !password)) {
				const pending = this.pending2FA.get(userId);
				if (pending && Date.now() - pending.timestamp < TWO_FA_EXPIRY_MS) {
					authEmail = pending.email;
					authPassword = pending.password;
				} else {
					this.pending2FA.delete(userId);
					return {
						success: false,
						error: "Session expired. Please try again.",
					};
				}
			}

			const api = new RingApi({
				email: authEmail,
				password: authPassword,
			} as unknown as ConstructorParameters<typeof RingApi>[0]);

			if (twoFactorCode) {
				await api.restClient.getAuth(twoFactorCode);
			}

			const locations = await api.getLocations();
			this.pending2FA.delete(userId);

			if (locations.length === 0) {
				return { success: false, error: "No Ring locations found" };
			}

			const refreshToken = api.restClient.refreshToken;
			if (refreshToken) {
				const encrypted = encrypt(
					JSON.stringify({ refreshToken }),
					config.ENCRYPTION_SECRET,
				);
				saveCredentials(userId, "ring", encrypted);
				this.apiInstances.set(userId, api);
				await this.discoverDevices(userId, api);
				this.setupEventListeners(userId, api);
			}

			return { success: true };
		} catch (error: unknown) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error";

			if (
				errorMsg.startsWith("Verification Code") ||
				errorMsg.includes("Invalid 2fa code")
			) {
				return {
					success: false,
					requiresTwoFactor: true,
					prompt: "Invalid code. Please try again.",
					error: "Invalid verification code",
				};
			}

			if (errorMsg.includes("2-factor") || errorMsg.includes("2fa")) {
				if (!twoFactorCode) {
					this.pending2FA.set(userId, {
						email: authEmail,
						password: authPassword,
						timestamp: Date.now(),
					});
				}
				return {
					success: false,
					requiresTwoFactor: true,
					prompt: "Please enter the 2FA code sent to your phone.",
				};
			}

			return { success: false, error: errorMsg || "Authentication failed" };
		}
	}

	async submitTwoFactorCode(
		userId: string,
		twoFactorCode: string,
	): Promise<{
		success: boolean;
		requiresTwoFactor?: boolean;
		prompt?: string;
		error?: string;
	}> {
		const pending = this.pending2FA.get(userId);
		if (!pending) {
			return {
				success: false,
				error: "No pending authentication. Please start over.",
			};
		}
		if (Date.now() - pending.timestamp > TWO_FA_EXPIRY_MS) {
			this.pending2FA.delete(userId);
			return { success: false, error: "Session expired. Please try again." };
		}
		return this.authenticate(
			userId,
			pending.email,
			pending.password,
			twoFactorCode,
		);
	}

	hasPending2FA(userId: string): boolean {
		const pending = this.pending2FA.get(userId);
		if (!pending) return false;
		if (Date.now() - pending.timestamp > TWO_FA_EXPIRY_MS) {
			this.pending2FA.delete(userId);
			return false;
		}
		return true;
	}

	cancelPending2FA(userId: string): void {
		this.pending2FA.delete(userId);
	}

	async connectWithStoredCredentials(userId: string): Promise<boolean> {
		try {
			const stored = getCredentials(userId, "ring");
			if (!stored) return false;

			const { refreshToken } = JSON.parse(
				decrypt(stored.credentials_encrypted, config.ENCRYPTION_SECRET),
			) as RingCredentials;

			const api = new RingApi({ refreshToken });
			await api.getLocations();

			this.apiInstances.set(userId, api);
			await this.discoverDevices(userId, api);
			this.setupEventListeners(userId, api);

			const newToken = api.restClient.refreshToken;
			if (newToken && newToken !== refreshToken) {
				const encrypted = encrypt(
					JSON.stringify({ refreshToken: newToken }),
					config.ENCRYPTION_SECRET,
				);
				saveCredentials(userId, "ring", encrypted);
			}

			return true;
		} catch {
			return false;
		}
	}

	private async discoverDevices(userId: string, api: RingApi): Promise<void> {
		const locations = await api.getLocations();

		for (const location of locations) {
			for (const camera of location.cameras) {
				const key = `${userId}:${camera.id}`;
				this.cameras.set(key, camera);

				const existing = deviceQueries.findByType
					.all(userId, "ring")
					.find((d) => d.device_id === String(camera.id));

				if (!existing) {
					createDevice(userId, "ring", camera.name, String(camera.id), {
						model: camera.model,
						deviceType: camera.deviceType,
					});
				}

				this.deviceStates.set(key, {
					id: String(camera.id),
					name: camera.name,
					type: camera.isDoorbot ? "doorbell" : "camera",
					status: "online",
					battery: camera.batteryLevel,
					hasLight: camera.hasLight,
					hasSiren: camera.hasSiren,
					lastMotion: null,
					lastDing: null,
				});
			}
		}
	}

	private setupEventListeners(userId: string, api: RingApi): void {
		api.onRefreshTokenUpdated.subscribe(({ newRefreshToken }) => {
			const encrypted = encrypt(
				JSON.stringify({ refreshToken: newRefreshToken }),
				config.ENCRYPTION_SECRET,
			);
			saveCredentials(userId, "ring", encrypted);
		});
	}

	async getDevices(userId: string): Promise<RingDeviceState[]> {
		const prefix = `${userId}:`;
		return Array.from(this.deviceStates.entries())
			.filter(([key]) => key.startsWith(prefix))
			.map(([, state]) => state);
	}

	async getSnapshot(userId: string, deviceId: string): Promise<Buffer | null> {
		const camera = this.cameras.get(`${userId}:${deviceId}`);
		if (!camera) return null;
		try {
			return await camera.getSnapshot();
		} catch {
			return null;
		}
	}

	async getLiveStreamUrl(
		userId: string,
		deviceId: string,
	): Promise<string | null> {
		const camera = this.cameras.get(`${userId}:${deviceId}`);
		if (!camera) return null;
		return `/api/ring/devices/${deviceId}/snapshot`;
	}

	async getHistory(
		userId: string,
		deviceId: string,
		limit = 20,
	): Promise<CameraEvent[]> {
		const camera = this.cameras.get(`${userId}:${deviceId}`);
		if (!camera) return [];
		try {
			const events = await camera.getEvents({ limit });
			return events.events || [];
		} catch {
			return [];
		}
	}

	async toggleLight(
		userId: string,
		deviceId: string,
		on: boolean,
	): Promise<boolean> {
		const camera = this.cameras.get(`${userId}:${deviceId}`);
		if (!camera?.hasLight) return false;
		try {
			await camera.setLight(on);
			return true;
		} catch {
			return false;
		}
	}

	async triggerSiren(userId: string, deviceId: string): Promise<boolean> {
		const camera = this.cameras.get(`${userId}:${deviceId}`);
		if (!camera?.hasSiren) return false;
		try {
			await camera.setSiren(true);
			setTimeout(() => camera.setSiren(false), 5000);
			return true;
		} catch {
			return false;
		}
	}

	subscribeToEvents(
		userId: string,
		callback: (event: RingEventPayload) => void,
	): () => void {
		const unsubscribers: (() => void)[] = [];
		const prefix = `${userId}:`;

		for (const [key, camera] of this.cameras) {
			if (!key.startsWith(prefix)) continue;

			const motionSub = camera.onMotionDetected.subscribe((motion) => {
				if (motion) {
					const event: RingEventPayload = {
						type: "motion",
						deviceId: camera.id,
						deviceName: camera.name,
						timestamp: new Date().toISOString(),
					};
					const state = this.deviceStates.get(key);
					if (state) state.lastMotion = event.timestamp;

					const device = deviceQueries.findByType
						.all(userId, "ring")
						.find((d) => d.device_id === String(camera.id));
					if (device) createEvent(device.id, "motion", event);
					callback(event);
				}
			});
			unsubscribers.push(() => motionSub.unsubscribe());

			if (camera.isDoorbot) {
				const dingSub = camera.onDoorbellPressed.subscribe((ding) => {
					if (ding) {
						const event: RingEventPayload = {
							type: "ding",
							deviceId: camera.id,
							deviceName: camera.name,
							timestamp: new Date().toISOString(),
						};
						const state = this.deviceStates.get(key);
						if (state) state.lastDing = event.timestamp;

						const device = deviceQueries.findByType
							.all(userId, "ring")
							.find((d) => d.device_id === String(camera.id));
						if (device) createEvent(device.id, "ding", event);
						callback(event);
					}
				});
				unsubscribers.push(() => dingSub.unsubscribe());
			}
		}

		return () => unsubscribers.forEach((unsub) => unsub());
	}

	isConnected(userId: string): boolean {
		return this.apiInstances.has(userId);
	}

	disconnect(userId: string): void {
		this.apiInstances.delete(userId);
		const prefix = `${userId}:`;
		for (const key of this.cameras.keys()) {
			if (key.startsWith(prefix)) {
				this.cameras.delete(key);
				this.deviceStates.delete(key);
			}
		}
	}

	getDeviceState(deviceId: string): RingDeviceState | undefined {
		for (const state of this.deviceStates.values()) {
			if (state.id === deviceId) return state;
		}
		return undefined;
	}

	shutdown(): void {
		this.apiInstances.clear();
		this.cameras.clear();
		this.deviceStates.clear();
		this.pending2FA.clear();
	}
}

export const ringService = new RingService();

export function getRingLiveState(
	deviceId: string,
): RingDeviceState | undefined {
	return ringService.getDeviceState(deviceId);
}
