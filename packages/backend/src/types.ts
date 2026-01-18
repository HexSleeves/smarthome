import type { ZodError } from "zod";

/**
 * Standard error type for catch blocks
 * Use `unknown` and type-guard instead of `any`
 */
export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	return "Unknown error";
}

/**
 * Type guard for ZodError
 */
export function isZodError(error: unknown): error is ZodError {
	return (
		error !== null &&
		typeof error === "object" &&
		"issues" in error &&
		Array.isArray((error as ZodError).issues)
	);
}

/**
 * Database row types (from better-sqlite3)
 */
export interface DbUserRow {
	id: string;
	email: string;
	password_hash: string;
	name: string | null;
	role: "admin" | "viewer";
	created_at: string;
	updated_at: string;
}

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

export interface DbSessionRow {
	id: string;
	user_id: string;
	refresh_token: string;
	user_agent: string | null;
	ip_address: string | null;
	expires_at: string;
	created_at: string;
}

export interface DbCredentialRow {
	id: string;
	user_id: string;
	provider: "roborock" | "ring";
	credentials_encrypted: string;
	created_at: string;
	updated_at: string;
}

/**
 * WebSocket message types
 */
export interface WsMessage {
	type: string;
	[key: string]: unknown;
}

export interface WsPingMessage {
	type: "ping";
}

export interface WsSubscribeMessage {
	type: "subscribe:ring" | "unsubscribe:ring";
}

export type WsIncomingMessage = WsPingMessage | WsSubscribeMessage | WsMessage;

/**
 * Ring event callback type
 */
export interface RingEventPayload {
	type: "motion" | "ding";
	deviceId: number;
	deviceName: string;
	timestamp: string;
}

/**
 * JWT payload type
 */
export interface JwtPayload {
	id: string;
	email: string;
	name?: string | null;
	role: "admin" | "viewer";
	iat?: number;
	exp?: number;
}

/**
 * Roborock command params - can be numbers, strings, or objects
 */
export type RoborockCommandParam = number | string | Record<string, unknown>;
