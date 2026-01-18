import Database, { type Database as DatabaseType } from "better-sqlite3";
import Fastify, { type FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import type { User } from "@smarthome/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { appRouter } from "../trpc/routers/index.js";
import type { TRPCContext } from "../trpc/trpc.js";

const JWT_SECRET = "test-jwt-secret-12345";

export interface TestContext {
	db: DatabaseType;
	app: FastifyInstance;
}

/**
 * Create an in-memory SQLite database with schema initialized
 */
export function createTestDb(): DatabaseType {
	const db = new Database(":memory:");

	db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('roborock', 'ring')),
      name TEXT NOT NULL,
      device_id TEXT,
      credentials_encrypted TEXT,
      config TEXT DEFAULT '{}',
      status TEXT DEFAULT 'offline',
      last_seen DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      data TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refresh_token TEXT NOT NULL,
      user_agent TEXT,
      ip_address TEXT,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS device_credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK (provider IN ('roborock', 'ring')),
      credentials_encrypted TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, provider)
    );
  `);

	return db;
}

/**
 * Create test queries bound to the provided database
 */
export function createTestQueries(db: DatabaseType) {
	return {
		userQueries: {
			create: db.prepare(
				"INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)",
			),
			findByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
			findById: db.prepare("SELECT * FROM users WHERE id = ?"),
			list: db.prepare("SELECT * FROM users ORDER BY created_at DESC"),
		},
		deviceQueries: {
			create: db.prepare(
				"INSERT INTO devices (id, user_id, type, name, device_id, config) VALUES (?, ?, ?, ?, ?, ?)",
			),
			findById: db.prepare("SELECT * FROM devices WHERE id = ?"),
			findByType: db.prepare(
				"SELECT * FROM devices WHERE user_id = ? AND type = ?",
			),
		},
		sessionQueries: {
			create: db.prepare(
				"INSERT INTO sessions (id, user_id, refresh_token, user_agent, ip_address, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
			),
			findByToken: db.prepare(
				"SELECT id, user_id, expires_at FROM sessions WHERE refresh_token = ?",
			),
			delete: db.prepare("DELETE FROM sessions WHERE id = ?"),
			deleteByUser: db.prepare("DELETE FROM sessions WHERE user_id = ?"),
		},
		credentialQueries: {
			upsert: db.prepare(`
        INSERT INTO device_credentials (id, user_id, provider, credentials_encrypted)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, provider) DO UPDATE SET
          credentials_encrypted = excluded.credentials_encrypted,
          updated_at = CURRENT_TIMESTAMP
      `),
			findByProvider: db.prepare(
				"SELECT * FROM device_credentials WHERE user_id = ? AND provider = ?",
			),
		},
	};
}

/**
 * Create a test Fastify app with tRPC registered
 */
export async function createTestApp(db: DatabaseType): Promise<FastifyInstance> {
	const app = Fastify({ logger: false });

	await app.register(cors, { origin: true, credentials: true });
	await app.register(formbody);
	await app.register(jwt, { secret: JWT_SECRET });

	// Create queries bound to test db
	const queries = createTestQueries(db);

	// Store queries on app for access in routes
	(app as unknown as { testQueries: typeof queries }).testQueries = queries;
	(app as unknown as { testDb: DatabaseType }).testDb = db;

	await app.register(fastifyTRPCPlugin, {
		prefix: "/api/trpc",
		trpcOptions: {
			router: appRouter,
			createContext: async ({
				req,
				res,
			}: {
				req: FastifyRequest;
				res: FastifyReply;
			}): Promise<TRPCContext> => {
				let user: User | null = null;

				const authHeader = req.headers.authorization;
				if (authHeader?.startsWith("Bearer ")) {
					try {
						const decoded = app.jwt.verify<User>(authHeader.slice(7));
						user = {
							id: decoded.id,
							email: decoded.email,
							name: decoded.name,
							role: decoded.role,
						};
					} catch {
						// Invalid token
					}
				}

				const signJwt = (payload: object, options?: { expiresIn?: string }) =>
					(app.jwt.sign as (p: unknown, o?: unknown) => string)(payload, options);

				return { req, res, user, signJwt };
			},
		},
	});

	return app;
}

/**
 * Helper to make tRPC requests
 */
export async function trpcRequest<T>(
	app: FastifyInstance,
	path: string,
	options: {
		method?: "GET" | "POST";
		input?: unknown;
		token?: string;
	} = {},
): Promise<{ status: number; body: T }> {
	const { method = "POST", input, token } = options;

	const headers: Record<string, string> = {
		"content-type": "application/json",
	};
	if (token) {
		headers.authorization = `Bearer ${token}`;
	}

	const url =
		method === "GET"
			? `/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify(input))}`
			: `/api/trpc/${path}`;

	const response = await app.inject({
		method,
		url,
		headers,
		payload: method === "POST" && input ? JSON.stringify(input) : undefined,
	});

	return {
		status: response.statusCode,
		body: JSON.parse(response.body) as T,
	};
}

/**
 * Generate a test JWT token
 */
export function generateTestToken(
	app: FastifyInstance,
	user: { id: string; email: string; role: "admin" | "viewer" },
): string {
	return app.jwt.sign(user, { expiresIn: "15m" });
}
