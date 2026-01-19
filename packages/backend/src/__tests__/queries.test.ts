import { v4 as uuid } from "uuid";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, createTestQueries } from "./test-utils.js";
import type { Database as DatabaseType } from "better-sqlite3";

describe("database queries", () => {
	let db: DatabaseType;
	let queries: ReturnType<typeof createTestQueries>;

	beforeEach(() => {
		db = createTestDb();
		queries = createTestQueries(db);
	});

	afterEach(() => {
		db.close();
	});

	describe("user queries", () => {
		it("creates a user and retrieves by email", () => {
			const id = uuid();
			const email = "test@example.com";
			const passwordHash = "hashed_password";
			const name = "Test User";
			const role = "viewer";

			queries.userQueries.create.run(id, email, passwordHash, name, role);
			const user = queries.userQueries.findByEmail.get(email) as {
				id: string;
				email: string;
				password_hash: string;
				name: string;
				role: string;
			};

			expect(user).toBeDefined();
			expect(user.id).toBe(id);
			expect(user.email).toBe(email);
			expect(user.password_hash).toBe(passwordHash);
			expect(user.name).toBe(name);
			expect(user.role).toBe(role);
		});

		it("retrieves user by id", () => {
			const id = uuid();
			const email = "test@example.com";

			queries.userQueries.create.run(id, email, "hash", "Name", "admin");
			const user = queries.userQueries.findById.get(id) as {
				id: string;
				role: string;
			};

			expect(user).toBeDefined();
			expect(user.id).toBe(id);
			expect(user.role).toBe("admin");
		});

		it("returns undefined for non-existent email", () => {
			const user = queries.userQueries.findByEmail.get("nonexistent@test.com");
			expect(user).toBeUndefined();
		});

		it("enforces unique email constraint", () => {
			const email = "duplicate@example.com";
			queries.userQueries.create.run(uuid(), email, "hash1", null, "viewer");

			expect(() =>
				queries.userQueries.create.run(uuid(), email, "hash2", null, "viewer"),
			).toThrow();
		});

		it("lists all users", () => {
			queries.userQueries.create.run(
				uuid(),
				"user1@test.com",
				"hash",
				null,
				"viewer",
			);
			queries.userQueries.create.run(
				uuid(),
				"user2@test.com",
				"hash",
				null,
				"admin",
			);

			const users = queries.userQueries.list.all();
			expect(users).toHaveLength(2);
		});
	});

	describe("device credentials queries", () => {
		let userId: string;

		beforeEach(() => {
			// Create a user first (required for foreign key)
			userId = uuid();
			queries.userQueries.create.run(
				userId,
				"user@test.com",
				"hash",
				null,
				"viewer",
			);
		});

		it("saves and retrieves credentials by provider", () => {
			const encrypted = "encrypted:data:here";
			queries.credentialQueries.upsert.run(uuid(), userId, "ring", encrypted);

			const cred = queries.credentialQueries.findByProvider.get(
				userId,
				"ring",
			) as {
				user_id: string;
				provider: string;
				credentials_encrypted: string;
			};

			expect(cred).toBeDefined();
			expect(cred.user_id).toBe(userId);
			expect(cred.provider).toBe("ring");
			expect(cred.credentials_encrypted).toBe(encrypted);
		});

		it("updates credentials on conflict (upsert)", () => {
			const encrypted1 = "encrypted:v1";
			const encrypted2 = "encrypted:v2";

			queries.credentialQueries.upsert.run(uuid(), userId, "ring", encrypted1);
			queries.credentialQueries.upsert.run(uuid(), userId, "ring", encrypted2);

			const cred = queries.credentialQueries.findByProvider.get(
				userId,
				"ring",
			) as {
				credentials_encrypted: string;
			};

			expect(cred.credentials_encrypted).toBe(encrypted2);
		});

		it("stores separate credentials per provider", () => {
			queries.credentialQueries.upsert.run(
				uuid(),
				userId,
				"ring",
				"ring-creds",
			);
			queries.credentialQueries.upsert.run(
				uuid(),
				userId,
				"roborock",
				"roborock-creds",
			);

			const ringCred = queries.credentialQueries.findByProvider.get(
				userId,
				"ring",
			) as { credentials_encrypted: string };
			const roborockCred = queries.credentialQueries.findByProvider.get(
				userId,
				"roborock",
			) as { credentials_encrypted: string };

			expect(ringCred.credentials_encrypted).toBe("ring-creds");
			expect(roborockCred.credentials_encrypted).toBe("roborock-creds");
		});

		it("returns undefined for non-existent provider", () => {
			const cred = queries.credentialQueries.findByProvider.get(userId, "ring");
			expect(cred).toBeUndefined();
		});
	});

	describe("session queries", () => {
		let userId: string;

		beforeEach(() => {
			userId = uuid();
			queries.userQueries.create.run(
				userId,
				"user@test.com",
				"hash",
				null,
				"viewer",
			);
		});

		it("creates and retrieves session by refresh token", () => {
			const sessionId = uuid();
			const refreshToken = uuid();
			const expiresAt = new Date(Date.now() + 86400000).toISOString();

			queries.sessionQueries.create.run(
				sessionId,
				userId,
				refreshToken,
				"Test Browser",
				"127.0.0.1",
				expiresAt,
			);

			const session = queries.sessionQueries.findByToken.get(refreshToken) as {
				id: string;
				user_id: string;
				expires_at: string;
			};

			expect(session).toBeDefined();
			expect(session.id).toBe(sessionId);
			expect(session.user_id).toBe(userId);
		});

		it("deletes session by id", () => {
			const sessionId = uuid();
			const refreshToken = uuid();

			queries.sessionQueries.create.run(
				sessionId,
				userId,
				refreshToken,
				null,
				null,
				new Date().toISOString(),
			);

			queries.sessionQueries.delete.run(sessionId);
			const session = queries.sessionQueries.findByToken.get(refreshToken);

			expect(session).toBeUndefined();
		});

		it("deletes all sessions for a user", () => {
			// Create multiple sessions
			for (let i = 0; i < 3; i++) {
				queries.sessionQueries.create.run(
					uuid(),
					userId,
					uuid(),
					null,
					null,
					new Date().toISOString(),
				);
			}

			queries.sessionQueries.deleteByUser.run(userId);

			// Check no sessions remain
			const count = db
				.prepare("SELECT COUNT(*) as count FROM sessions WHERE user_id = ?")
				.get(userId) as { count: number };
			expect(count.count).toBe(0);
		});
	});

	describe("device queries", () => {
		let userId: string;

		beforeEach(() => {
			userId = uuid();
			queries.userQueries.create.run(
				userId,
				"user@test.com",
				"hash",
				null,
				"viewer",
			);
		});

		it("creates and retrieves device by id", () => {
			const deviceId = uuid();
			const config = JSON.stringify({ setting: "value" });

			queries.deviceQueries.create.run(
				deviceId,
				userId,
				"ring",
				"Front Door",
				"external-id",
				config,
			);

			const device = queries.deviceQueries.findById.get(deviceId) as {
				id: string;
				user_id: string;
				type: string;
				name: string;
			};

			expect(device).toBeDefined();
			expect(device.id).toBe(deviceId);
			expect(device.type).toBe("ring");
			expect(device.name).toBe("Front Door");
		});

		it("finds devices by type", () => {
			queries.deviceQueries.create.run(
				uuid(),
				userId,
				"ring",
				"Doorbell",
				null,
				"{}",
			);
			queries.deviceQueries.create.run(
				uuid(),
				userId,
				"roborock",
				"Vacuum",
				null,
				"{}",
			);

			const ringDevice = queries.deviceQueries.findByType.get(
				userId,
				"ring",
			) as { name: string };

			expect(ringDevice).toBeDefined();
			expect(ringDevice.name).toBe("Doorbell");
		});
	});
});
