import { v4 as uuid } from "uuid";
import { db } from "./schema.js";

export interface User {
	id: string;
	email: string;
	password_hash: string;
	name: string | null;
	role: "admin" | "viewer";
	created_at: string;
	updated_at: string;
}

export interface Device {
	id: string;
	user_id: string;
	type: "roborock" | "ring";
	name: string;
	device_id: string | null;
	credentials_encrypted: string | null;
	config: string;
	status: string;
	last_seen: string | null;
	created_at: string;
	updated_at: string;
}

export interface DeviceCredential {
	id: string;
	user_id: string;
	provider: "roborock" | "ring";
	credentials_encrypted: string;
	created_at: string;
	updated_at: string;
}

// Prepared statements using bun:sqlite API with positional parameters
export const userQueries = {
	create: db.query(
		"INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)",
	),
	findByEmail: db.query<User, [string]>(
		"SELECT * FROM users WHERE email = ?",
	),
	findById: db.query<User, [string]>("SELECT * FROM users WHERE id = ?"),
	list: db.query<User, []>("SELECT * FROM users ORDER BY created_at DESC"),
};

export const deviceQueries = {
	create: db.query(
		"INSERT INTO devices (id, user_id, type, name, device_id, config) VALUES (?, ?, ?, ?, ?, ?)",
	),
	findById: db.query<Device, [string]>("SELECT * FROM devices WHERE id = ?"),
	findByType: db.query<Device, [string, string]>(
		"SELECT * FROM devices WHERE user_id = ? AND type = ?",
	),
	updateStatus: db.query(
		"UPDATE devices SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?",
	),
};

export const credentialQueries = {
	upsert: db.query(`
		INSERT INTO device_credentials (id, user_id, provider, credentials_encrypted)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(user_id, provider) DO UPDATE SET
			credentials_encrypted = excluded.credentials_encrypted,
			updated_at = CURRENT_TIMESTAMP
	`),
	findByProvider: db.query<DeviceCredential, [string, string]>(
		"SELECT * FROM device_credentials WHERE user_id = ? AND provider = ?",
	),
	findAllByProvider: db.query<{ user_id: string }, [string]>(
		"SELECT user_id FROM device_credentials WHERE provider = ?",
	),
};

export const sessionQueries = {
	create: db.query(
		"INSERT INTO sessions (id, user_id, refresh_token, user_agent, ip_address, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
	),
	findByToken: db.query<
		{ id: string; user_id: string; expires_at: string },
		[string]
	>("SELECT id, user_id, expires_at FROM sessions WHERE refresh_token = ?"),
	delete: db.query("DELETE FROM sessions WHERE id = ?"),
	deleteByUser: db.query("DELETE FROM sessions WHERE user_id = ?"),
};

export const eventQueries = {
	create: db.query(
		"INSERT INTO events (id, device_id, type, data) VALUES (?, ?, ?, ?)",
	),
};

export function createUser(
	email: string,
	passwordHash: string,
	name?: string,
	role: "admin" | "viewer" = "viewer",
): User {
	const id = uuid();
	userQueries.create.run(id, email, passwordHash, name || null, role);
	const user = userQueries.findById.get(id);
	if (!user) throw new Error("Failed to create user");
	return user;
}

export function createDevice(
	userId: string,
	type: "roborock" | "ring",
	name: string,
	deviceId?: string,
	config: object = {},
): Device {
	const id = uuid();
	deviceQueries.create.run(
		id,
		userId,
		type,
		name,
		deviceId || null,
		JSON.stringify(config),
	);
	const device = deviceQueries.findById.get(id);
	if (!device) throw new Error("Failed to create device");
	return device;
}

export function createEvent(
	deviceId: string,
	type: string,
	data: object = {},
): void {
	eventQueries.create.run(uuid(), deviceId, type, JSON.stringify(data));
}

export function saveCredentials(
	userId: string,
	provider: "roborock" | "ring",
	encrypted: string,
): void {
	credentialQueries.upsert.run(uuid(), userId, provider, encrypted);
}

export function getCredentials(
	userId: string,
	provider: "roborock" | "ring",
): DeviceCredential | undefined {
	return credentialQueries.findByProvider.get(userId, provider) ?? undefined;
}

export function hasCredentials(
	userId: string,
	provider: "roborock" | "ring",
): boolean {
	return !!credentialQueries.findByProvider.get(userId, provider);
}

export function getUsersWithCredentials(
	provider: "roborock" | "ring",
): string[] {
	return credentialQueries.findAllByProvider
		.all(provider)
		.map((r) => r.user_id);
}
