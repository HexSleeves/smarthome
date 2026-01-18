export interface User {
	id: string;
	email: string;
	name: string | null;
	role: "admin" | "viewer";
	createdAt?: string;
}

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

export interface RealtimeEvent {
	type: string;
	timestamp: Date;
	deviceId?: string;
	deviceName?: string;
	state?: RoborockDeviceState;
}
