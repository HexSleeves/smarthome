import { RingApi, RingCamera } from "ring-client-api";
import { decrypt, encrypt } from "../lib/crypto.js";
import {
	saveCredentials,
	getCredentials,
	createDevice,
	deviceQueries,
	createEvent,
} from "../db/queries.js";
import { EventEmitter } from "node:events";

const ENCRYPTION_SECRET =
	process.env.ENCRYPTION_SECRET || "dev-secret-change-in-production";

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

// Store pending 2FA sessions (email/password waiting for code)
interface Pending2FASession {
	email: string;
	password: string;
	timestamp: number;
}

class RingService extends EventEmitter {
	private readonly apiInstances: Map<string, RingApi> = new Map();
	private readonly cameras: Map<string, RingCamera> = new Map();
	private readonly deviceStates: Map<string, RingDeviceState> = new Map();
	private readonly pending2FA: Map<string, Pending2FASession> = new Map();

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
		// Define these outside try so they're accessible in catch
		let authEmail = email;
		let authPassword = password;

		try {
			// If we have a 2FA code but no email/password, try to get from pending session

			if (twoFactorCode && (!email || !password)) {
				const pending = this.pending2FA.get(userId);
				if (pending && Date.now() - pending.timestamp < 10 * 60 * 1000) {
					// 10 min expiry
					authEmail = pending.email;
					authPassword = pending.password;
				} else {
					this.pending2FA.delete(userId);
					return {
						success: false,
						error: "Session expired. Please enter email and password again.",
					};
				}
			}

			console.log(
				`Ring auth attempt for ${authEmail}, 2FA code: ${twoFactorCode ? "provided" : "not provided"}`,
			);

			const api = new RingApi({
				email: authEmail,
				password: authPassword,
				...(twoFactorCode && { twoFactorAuthCode: twoFactorCode }),
			});

			// This will trigger auth and get refresh token
			const locations = await api.getLocations();

			// Success - clear any pending 2FA session
			this.pending2FA.delete(userId);

			if (locations.length === 0) {
				return { success: false, error: "No Ring locations found" };
			}

			// Get the refresh token from the API
			const refreshToken = api.restClient.refreshToken;

			if (refreshToken) {
				// Save encrypted credentials
				const encrypted = encrypt(
					JSON.stringify({ refreshToken }),
					ENCRYPTION_SECRET,
				);
				saveCredentials(userId, "ring", encrypted);

				// Store API instance
				this.apiInstances.set(userId, api);

				// Discover devices
				await this.discoverDevices(userId, api);

				// Set up event listeners
				this.setupEventListeners(userId, api);
			}

			return { success: true };
		} catch (error: any) {
			const errorMsg = error.message || "";
			console.log("Ring auth error message:", errorMsg);

			// Check if it's an invalid 2FA code (status 400 with "Verification Code" error)
			if (
				errorMsg.startsWith("Verification Code") ||
				errorMsg.includes("Invalid 2fa code")
			) {
				// Don't overwrite pending session - just return error for retry
				console.log("Ring 2FA code invalid, allowing retry");
				return {
					success: false,
					requiresTwoFactor: true,
					prompt: "Invalid code. Please check and try again.",
					error: "Invalid verification code",
				};
			}

			// Check if 2FA is required (initial request, status 412)
			if (errorMsg.includes("2-factor") || errorMsg.includes("2fa")) {
				// Only store credentials if this is the initial 2FA trigger (no code was provided)
				if (!twoFactorCode) {
					this.pending2FA.set(userId, {
						email: authEmail,
						password: authPassword,
						timestamp: Date.now(),
					});
					console.log("Ring 2FA required, storing pending session");
				} else {
					console.log(
						"Ring 2FA still required after code submission - code may be wrong",
					);
				}

				return {
					success: false,
					requiresTwoFactor: true,
					prompt: "Please enter the 2FA code sent to your phone.",
				};
			}

			console.error("Ring auth error:", error);
			return { success: false, error: errorMsg || "Authentication failed" };
		}
	}

	// New method: submit just the 2FA code using stored credentials
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

		if (Date.now() - pending.timestamp > 10 * 60 * 1000) {
			this.pending2FA.delete(userId);
			return {
				success: false,
				error: "Session expired. Please enter email and password again.",
			};
		}

		// Re-authenticate with the stored credentials + 2FA code
		const result = await this.authenticate(
			userId,
			pending.email,
			pending.password,
			twoFactorCode,
		);
		return result;
	}

	// Check if there's a pending 2FA session for this user
	hasPending2FA(userId: string): boolean {
		const pending = this.pending2FA.get(userId);
		if (!pending) return false;

		// Check if not expired (10 min)
		if (Date.now() - pending.timestamp > 10 * 60 * 1000) {
			this.pending2FA.delete(userId);
			return false;
		}

		return true;
	}

	// Cancel pending 2FA session
	cancelPending2FA(userId: string): void {
		this.pending2FA.delete(userId);
	}

	async connectWithStoredCredentials(userId: string): Promise<boolean> {
		try {
			const stored = getCredentials(userId, "ring");
			if (!stored) return false;

			const { refreshToken } = JSON.parse(
				decrypt(stored.credentials_encrypted, ENCRYPTION_SECRET),
			) as RingCredentials;

			const api = new RingApi({ refreshToken });

			// Verify connection works
			await api.getLocations();

			this.apiInstances.set(userId, api);
			await this.discoverDevices(userId, api);
			this.setupEventListeners(userId, api);

			// Update stored token if it changed
			const newToken = api.restClient.refreshToken;
			if (newToken && newToken !== refreshToken) {
				const encrypted = encrypt(
					JSON.stringify({ refreshToken: newToken }),
					ENCRYPTION_SECRET,
				);
				saveCredentials(userId, "ring", encrypted);
			}

			return true;
		} catch (error) {
			console.error("Ring reconnect error:", error);
			return false;
		}
	}

	private async discoverDevices(userId: string, api: RingApi): Promise<void> {
		const locations = await api.getLocations();

		for (const location of locations) {
			const cameras = location.cameras;

			for (const camera of cameras) {
				const cameraKey = `${userId}:${camera.id}`;
				this.cameras.set(cameraKey, camera);

				// Check if device exists in DB
				const existing = deviceQueries.findByType
					.all(userId, "ring")
					.find((d) => d.device_id === String(camera.id));

				if (!existing) {
					createDevice(userId, "ring", camera.name, String(camera.id), {
						model: camera.model,
						deviceType: camera.deviceType,
					});
				}

				// Track state
				const state: RingDeviceState = {
					id: String(camera.id),
					name: camera.name,
					type: camera.isDoorbot ? "doorbell" : "camera",
					status: "online",
					battery: camera.batteryLevel,
					hasLight: camera.hasLight,
					hasSiren: camera.hasSiren,
					lastMotion: null,
					lastDing: null,
				};
				this.deviceStates.set(cameraKey, state);
			}
		}
	}

	private setupEventListeners(userId: string, api: RingApi): void {
		api.onRefreshTokenUpdated.subscribe(({ newRefreshToken }) => {
			const encrypted = encrypt(
				JSON.stringify({ refreshToken: newRefreshToken }),
				ENCRYPTION_SECRET,
			);
			saveCredentials(userId, "ring", encrypted);
		});
	}

	async getDevices(userId: string): Promise<RingDeviceState[]> {
		const states: RingDeviceState[] = [];

		for (const [key, state] of this.deviceStates) {
			if (key.startsWith(`${userId}:`)) {
				states.push(state);
			}
		}

		return states;
	}

	async getSnapshot(userId: string, deviceId: string): Promise<Buffer | null> {
		const camera = this.cameras.get(`${userId}:${deviceId}`);
		if (!camera) return null;

		try {
			return await camera.getSnapshot();
		} catch (error) {
			console.error("Failed to get snapshot:", error);
			return null;
		}
	}

	async getLiveStreamUrl(
		userId: string,
		deviceId: string,
	): Promise<string | null> {
		const camera = this.cameras.get(`${userId}:${deviceId}`);
		if (!camera) return null;

		try {
			// Ring uses WebRTC/SIP for live streaming
			// For browser compatibility, we'd need to set up a media server
			// For now, return snapshot URL as fallback
			return `/api/ring/devices/${deviceId}/snapshot`;
		} catch (error) {
			console.error("Failed to get live stream:", error);
			return null;
		}
	}

	async getHistory(
		userId: string,
		deviceId: string,
		limit = 20,
	): Promise<any[]> {
		const camera = this.cameras.get(`${userId}:${deviceId}`);
		if (!camera) return [];

		try {
			const events = await camera.getEvents({ limit });
			return events.events || [];
		} catch (error) {
			console.error("Failed to get history:", error);
			return [];
		}
	}

	async toggleLight(
		userId: string,
		deviceId: string,
		on: boolean,
	): Promise<boolean> {
		const camera = this.cameras.get(`${userId}:${deviceId}`);
		if (!camera || !camera.hasLight) return false;

		try {
			await camera.setLight(on);
			return true;
		} catch (error) {
			console.error("Failed to toggle light:", error);
			return false;
		}
	}

	async triggerSiren(userId: string, deviceId: string): Promise<boolean> {
		const camera = this.cameras.get(`${userId}:${deviceId}`);
		if (!camera || !camera.hasSiren) return false;

		try {
			await camera.setSiren(true);
			setTimeout(() => camera.setSiren(false), 5000); // Auto-off after 5s
			return true;
		} catch (error) {
			console.error("Failed to trigger siren:", error);
			return false;
		}
	}

	subscribeToEvents(
		userId: string,
		callback: (event: any) => void,
	): () => void {
		const unsubscribers: (() => void)[] = [];

		for (const [key, camera] of this.cameras) {
			if (key.startsWith(`${userId}:`)) {
				// Motion events
				const motionSub = camera.onMotionDetected.subscribe((motion) => {
					if (motion) {
						const event = {
							type: "motion",
							deviceId: camera.id,
							deviceName: camera.name,
							timestamp: new Date().toISOString(),
						};

						// Update state
						const state = this.deviceStates.get(key);
						if (state) state.lastMotion = event.timestamp;

						// Store event
						const device = deviceQueries.findByType
							.all(userId, "ring")
							.find((d) => d.device_id === String(camera.id));
						if (device) createEvent(device.id, "motion", event);

						callback(event);
					}
				});
				unsubscribers.push(() => motionSub.unsubscribe());

				// Doorbell events
				if (camera.isDoorbot) {
					const dingSub = camera.onDoorbellPressed.subscribe((ding) => {
						if (ding) {
							const event = {
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
		}

		return () => unsubscribers.forEach((unsub) => unsub());
	}

	isConnected(userId: string): boolean {
		return this.apiInstances.has(userId);
	}

	disconnect(userId: string): void {
		this.apiInstances.delete(userId);

		// Clean up cameras for this user
		for (const key of this.cameras.keys()) {
			if (key.startsWith(`${userId}:`)) {
				this.cameras.delete(key);
				this.deviceStates.delete(key);
			}
		}
	}
}

export const ringService = new RingService();
