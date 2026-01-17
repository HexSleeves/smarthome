// User types
export interface User {
	id: string;
	email: string;
	name: string | null;
	role: "admin" | "viewer";
	createdAt?: string;
}

export interface AuthResponse {
	user: User;
	accessToken: string;
	refreshToken: string;
}

// Device types
export interface Device {
	id: string;
	user_id: string;
	type: "roborock" | "ring";
	name: string;
	device_id: string | null;
	config: Record<string, unknown>;
	status: string;
	last_seen: string | null;
	created_at: string;
	updated_at: string;
	liveState?: RoborockDeviceState | RingDeviceState;
}

export interface DeviceEvent {
	id: string;
	device_id: string;
	type: string;
	data: Record<string, unknown>;
	created_at: string;
}

// Roborock types
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

export interface RoborockCleanHistory {
	id: string;
	start_time: number;
	end_time: number;
	duration: number;
	area: number;
}

// Ring types
export interface RingDeviceState {
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

export interface RingEvent {
	id: string;
	created_at: string;
	kind: string;
	favorite: boolean;
	snoozed: boolean;
}

// WebSocket event types
export interface WsRoborockStatusEvent {
	type: string;
	deviceId: string;
	state: RoborockDeviceState;
}

export interface WsRingEvent {
	type: string;
	deviceId: string;
	deviceName: string;
	timestamp: string;
}

// Realtime event for dashboard
export interface RealtimeEvent {
	type: string;
	timestamp: Date;
	deviceId?: string;
	deviceName?: string;
	state?: RoborockDeviceState;
}
