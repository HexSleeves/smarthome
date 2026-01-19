import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { type CameraEvent, RingApi, type RingCamera } from "ring-client-api";

// Type for the streaming session returned by camera.streamVideo()
interface StreamingSessionLike {
	onCallEnded: { subscribe: (callback: () => void) => void };
	stop: () => void;
}
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

// HLS streaming session
interface HlsStreamSession {
	sessionId: string;
	streamingSession: StreamingSessionLike;
	outputDir: string;
	startedAt: number;
	lastAccess: number;
}

// Base directory for HLS stream output
const HLS_OUTPUT_BASE = "/tmp/ring-streams";
const STREAM_IDLE_TIMEOUT = 60 * 1000; // Stop stream after 1 minute of no access
const STREAM_MAX_DURATION = 10 * 60 * 1000; // Max 10 minutes per stream

class RingService extends EventEmitter {
	private readonly apiInstances = new Map<string, RingApi>();
	private readonly cameras = new Map<string, RingCamera>();
	private readonly deviceStates = new Map<string, RingDeviceState>();
	private readonly pending2FA = new Map<string, Pending2FASession>();
	private readonly hlsSessions = new Map<string, HlsStreamSession>();
	private cleanupInterval: ReturnType<typeof setInterval> | null = null;

	constructor() {
		super();
		// Ensure output directory exists
		if (!existsSync(HLS_OUTPUT_BASE)) {
			mkdirSync(HLS_OUTPUT_BASE, { recursive: true });
		}
		// Start cleanup interval
		this.cleanupInterval = setInterval(() => this.cleanupIdleStreams(), 10000);
	}

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

		return () =>
			unsubscribers.forEach((unsub) => {
				unsub();
			});
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

	/**
	 * Start an HLS streaming session.
	 * Returns session ID and the base URL for the HLS stream.
	 */
	async startHlsStream(
		userId: string,
		deviceId: string,
	): Promise<{ sessionId: string; streamUrl: string } | null> {
		const camera = this.cameras.get(`${userId}:${deviceId}`);
		if (!camera) {
			console.error(`Camera not found for user ${userId}, device ${deviceId}`);
			return null;
		}

		// Check if there's already an active stream for this device
		const existingKey = `${userId}:${deviceId}`;
		const existingSession = this.hlsSessions.get(existingKey);
		if (existingSession) {
			// Update last access and return existing stream
			existingSession.lastAccess = Date.now();
			return {
				sessionId: existingSession.sessionId,
				streamUrl: `/api/ring/stream/${existingSession.sessionId}/stream.m3u8`,
			};
		}

		try {
			const sessionId = `${deviceId}-${Date.now()}`;
			const outputDir = join(HLS_OUTPUT_BASE, sessionId);

			// Create output directory
			if (!existsSync(outputDir)) {
				mkdirSync(outputDir, { recursive: true });
			}

			console.log(
				`Starting HLS stream for device ${deviceId}, output: ${outputDir}`,
			);

			// Start the stream with HLS output
			const streamingSession = await camera.streamVideo({
				// Audio transcoding - convert to AAC-LC which is maximally browser compatible
				audio: [
					"-acodec",
					"aac",
					"-ac",
					"2",
					"-ar",
					"44100",
					"-b:a",
					"128k",
					"-profile:a",
					"aac_low",
				],
				// Video - copy H264 directly (fast, but may have browser issues)
				video: [
					"-vcodec",
					"copy",
				],
				output: [
					"-f",
					"hls",
					"-hls_time",
					"2",
					"-hls_list_size",
					"6",
					"-hls_flags",
					"delete_segments",
					join(outputDir, "stream.m3u8"),
				],
			});

			const session: HlsStreamSession = {
				sessionId,
				streamingSession,
				outputDir,
				startedAt: Date.now(),
				lastAccess: Date.now(),
			};

			this.hlsSessions.set(existingKey, session);

			// Handle stream end
			streamingSession.onCallEnded.subscribe(() => {
				console.log(`HLS stream ended for device ${deviceId}`);
				this.cleanupHlsSession(existingKey);
			});

			return {
				sessionId,
				streamUrl: `/api/ring/stream/${sessionId}/stream.m3u8`,
			};
		} catch (error) {
			console.error("Failed to start HLS stream:", error);
			return null;
		}
	}

	/**
	 * Stop an HLS streaming session
	 */
	async stopHlsStream(userId: string, deviceId: string): Promise<boolean> {
		const sessionKey = `${userId}:${deviceId}`;
		return this.cleanupHlsSession(sessionKey);
	}

	/**
	 * Get the output directory for a stream session (for serving files)
	 */
	getStreamOutputDir(sessionId: string): string | null {
		for (const session of this.hlsSessions.values()) {
			if (session.sessionId === sessionId) {
				session.lastAccess = Date.now();
				return session.outputDir;
			}
		}
		return null;
	}

	/**
	 * Check if a stream is active
	 */
	isStreamActive(userId: string, deviceId: string): boolean {
		return this.hlsSessions.has(`${userId}:${deviceId}`);
	}

	/**
	 * Update last access time for a stream (call when serving HLS files)
	 */
	touchStream(sessionId: string): void {
		for (const session of this.hlsSessions.values()) {
			if (session.sessionId === sessionId) {
				session.lastAccess = Date.now();
				return;
			}
		}
	}

	private cleanupHlsSession(sessionKey: string): boolean {
		const session = this.hlsSessions.get(sessionKey);
		if (!session) {
			return false;
		}

		try {
			session.streamingSession.stop();
		} catch (error) {
			console.error("Error stopping streaming session:", error);
		}

		// Clean up output directory
		try {
			if (existsSync(session.outputDir)) {
				rmSync(session.outputDir, { recursive: true, force: true });
			}
		} catch (error) {
			console.error("Error cleaning up stream directory:", error);
		}

		this.hlsSessions.delete(sessionKey);
		console.log(`Cleaned up HLS session: ${session.sessionId}`);
		return true;
	}

	private cleanupIdleStreams(): void {
		const now = Date.now();
		for (const [key, session] of this.hlsSessions) {
			const idleTime = now - session.lastAccess;
			const totalTime = now - session.startedAt;

			if (idleTime > STREAM_IDLE_TIMEOUT || totalTime > STREAM_MAX_DURATION) {
				console.log(
					`Cleaning up idle/expired stream: ${session.sessionId} (idle: ${idleTime}ms, total: ${totalTime}ms)`,
				);
				this.cleanupHlsSession(key);
			}
		}
	}

	shutdown(): void {
		// Stop cleanup interval
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}

		// End all active HLS streaming sessions
		for (const key of this.hlsSessions.keys()) {
			this.cleanupHlsSession(key);
		}

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
