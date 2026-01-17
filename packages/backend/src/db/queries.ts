import { db } from "./schema.js";
import { v4 as uuid } from "uuid";

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

export interface Event {
	id: string;
	device_id: string;
	type: string;
	data: string;
	created_at: string;
}

export interface DeviceCredential {
	id: string;
	user_id: string;
	provider: "roborock" | "ring";
	credentials_encrypted: string;
	created_at: string;
	updated_at: string;
}

// User queries
export const userQueries = {
	create: db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role)
    VALUES (?, ?, ?, ?, ?)
  `),

	findByEmail: db.prepare<[string], User>(`
    SELECT * FROM users WHERE email = ?
  `),

	findById: db.prepare<[string], User>(`
    SELECT * FROM users WHERE id = ?
  `),

	updateRole: db.prepare(`
    UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `),

	list: db.prepare<[], User>(`
    SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC
  `),
};

// Device queries
export const deviceQueries = {
	create: db.prepare(`
    INSERT INTO devices (id, user_id, type, name, device_id, config)
    VALUES (?, ?, ?, ?, ?, ?)
  `),

	findById: db.prepare<[string], Device>(`
    SELECT * FROM devices WHERE id = ?
  `),

	findByUserId: db.prepare<[string], Device>(`
    SELECT * FROM devices WHERE user_id = ? ORDER BY created_at DESC
  `),

	findByType: db.prepare<[string, string], Device>(`
    SELECT * FROM devices WHERE user_id = ? AND type = ?
  `),

	updateStatus: db.prepare(`
    UPDATE devices SET status = ?, last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `),

	updateConfig: db.prepare(`
    UPDATE devices SET config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `),

	delete: db.prepare(`
    DELETE FROM devices WHERE id = ?
  `),
};

// Event queries
export const eventQueries = {
	create: db.prepare(`
    INSERT INTO events (id, device_id, type, data)
    VALUES (?, ?, ?, ?)
  `),

	findByDevice: db.prepare<[string, number], Event>(`
    SELECT * FROM events WHERE device_id = ? ORDER BY created_at DESC LIMIT ?
  `),

	findByType: db.prepare<[string, string, number], Event>(`
    SELECT * FROM events WHERE device_id = ? AND type = ? ORDER BY created_at DESC LIMIT ?
  `),

	findRecent: db.prepare<[string, number], Event>(`
    SELECT e.* FROM events e
    JOIN devices d ON e.device_id = d.id
    WHERE d.user_id = ?
    ORDER BY e.created_at DESC LIMIT ?
  `),
};

// Device credentials queries
export const credentialQueries = {
	upsert: db.prepare(`
    INSERT INTO device_credentials (id, user_id, provider, credentials_encrypted)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, provider) DO UPDATE SET
      credentials_encrypted = excluded.credentials_encrypted,
      updated_at = CURRENT_TIMESTAMP
  `),

	findByProvider: db.prepare<[string, string], DeviceCredential>(`
    SELECT * FROM device_credentials WHERE user_id = ? AND provider = ?
  `),

	delete: db.prepare(`
    DELETE FROM device_credentials WHERE user_id = ? AND provider = ?
  `),
};

// Session queries
export const sessionQueries = {
	create: db.prepare(`
    INSERT INTO sessions (id, user_id, refresh_token, user_agent, ip_address, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),

	findByToken: db.prepare<
		[string],
		{ id: string; user_id: string; expires_at: string }
	>(`
    SELECT id, user_id, expires_at FROM sessions WHERE refresh_token = ?
  `),

	delete: db.prepare(`
    DELETE FROM sessions WHERE id = ?
  `),

	deleteExpired: db.prepare(`
    DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP
  `),

	deleteByUser: db.prepare(`
    DELETE FROM sessions WHERE user_id = ?
  `),
};

// Helper functions
export function createUser(
	email: string,
	passwordHash: string,
	name?: string,
	role: "admin" | "viewer" = "viewer",
): User {
	const id = uuid();
	userQueries.create.run(id, email, passwordHash, name || null, role);
	return userQueries.findById.get(id)!;
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
	return deviceQueries.findById.get(id)!;
}

export function createEvent(
	deviceId: string,
	type: string,
	data: object = {},
): Event {
	const id = uuid();
	eventQueries.create.run(id, deviceId, type, JSON.stringify(data));
	return {
		id,
		device_id: deviceId,
		type,
		data: JSON.stringify(data),
		created_at: new Date().toISOString(),
	};
}

export function saveCredentials(
	userId: string,
	provider: "roborock" | "ring",
	encryptedCredentials: string,
): void {
	const id = uuid();
	credentialQueries.upsert.run(id, userId, provider, encryptedCredentials);
}

export function getCredentials(
	userId: string,
	provider: "roborock" | "ring",
): DeviceCredential | undefined {
	return credentialQueries.findByProvider.get(userId, provider);
}

export function hasCredentials(
	userId: string,
	provider: "roborock" | "ring",
): boolean {
	return !!credentialQueries.findByProvider.get(userId, provider);
}
