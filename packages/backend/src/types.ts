import type { ZodError } from "zod";

// Type guard for ZodError
export function isZodError(error: unknown): error is ZodError {
	return (
		error !== null &&
		typeof error === "object" &&
		"issues" in error &&
		Array.isArray((error as ZodError).issues)
	);
}

// Database row types
export interface DbDeviceRow {
	id: string;
	user_id: string;
	type: "roborock" | "ring";
	name: string;
	device_id: string | null;
	config: string;
	status: string;
	last_seen: string | null;
	created_at: string;
	updated_at: string;
}

export interface DbEventRow {
	id: string;
	device_id: string;
	type: string;
	data: string;
	created_at: string;
}

// WebSocket message types
export type WsIncomingMessage =
	| { type: "ping" }
	| { type: "subscribe:ring" }
	| { type: "unsubscribe:ring" };

// Ring event callback type
export interface RingEventPayload {
	type: "motion" | "ding";
	deviceId: number;
	deviceName: string;
	timestamp: string;
}

// JWT payload type
export interface JwtPayload {
	id: string;
	email: string;
	role: "admin" | "viewer";
	iat?: number;
	exp?: number;
}

// Roborock API types
export type RoborockCommandParam = number | string | Record<string, unknown>;
