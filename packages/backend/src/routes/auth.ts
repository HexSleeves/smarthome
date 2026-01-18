import * as argon2 from "argon2";
import type { FastifyInstance } from "fastify";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { createUser, sessionQueries, userQueries } from "../db/queries.js";
import type { AuthUser } from "../middleware/auth.js";
import { isZodError } from "../types.js";

const registerSchema = z.object({
	email: z.email(),
	password: z.string().min(8),
	name: z.string().optional(),
});

const loginSchema = z.object({
	email: z.email(),
	password: z.string(),
});

export async function authRoutes(fastify: FastifyInstance) {
	// Register
	fastify.post("/register", async (request, reply) => {
		try {
			const body = registerSchema.parse(request.body);

			// Check if user exists
			const existing = userQueries.findByEmail.get(body.email);
			if (existing) {
				return reply.status(400).send({ error: "Email already registered" });
			}

			// Hash password
			const passwordHash = await argon2.hash(body.password);

			// First user becomes admin
			const users = userQueries.list.all();
			const role = users.length === 0 ? "admin" : "viewer";

			// Create user
			const user = createUser(body.email, passwordHash, body.name, role);

			// Generate tokens
			const accessToken = fastify.jwt.sign(
				{ id: user.id, email: user.email, role: user.role },
				{ expiresIn: "15m" },
			);

			const refreshToken = uuid();
			const expiresAt = new Date(
				Date.now() + 7 * 24 * 60 * 60 * 1000,
			).toISOString();

			sessionQueries.create.run(
				uuid(),
				user.id,
				refreshToken,
				request.headers["user-agent"] || null,
				request.ip,
				expiresAt,
			);

			return {
				user: {
					id: user.id,
					email: user.email,
					name: user.name,
					role: user.role,
				},
				accessToken,
				refreshToken,
			};
		} catch (error: unknown) {
			if (isZodError(error)) {
				return reply
					.status(400)
					.send({ error: "Validation failed", details: error.issues });
			}
			console.error("Register error:", error);
			return reply.status(500).send({ error: "Registration failed" });
		}
	});

	// Login
	fastify.post("/login", async (request, reply) => {
		try {
			const body = loginSchema.parse(request.body);

			const user = userQueries.findByEmail.get(body.email);
			if (!user) {
				return reply.status(401).send({ error: "Invalid credentials" });
			}

			const validPassword = await argon2.verify(
				user.password_hash,
				body.password,
			);
			if (!validPassword) {
				return reply.status(401).send({ error: "Invalid credentials" });
			}

			// Generate tokens
			const accessToken = fastify.jwt.sign(
				{ id: user.id, email: user.email, role: user.role },
				{ expiresIn: "15m" },
			);

			const refreshToken = uuid();
			const expiresAt = new Date(
				Date.now() + 7 * 24 * 60 * 60 * 1000,
			).toISOString();

			sessionQueries.create.run(
				uuid(),
				user.id,
				refreshToken,
				request.headers["user-agent"] || null,
				request.ip,
				expiresAt,
			);

			return {
				user: {
					id: user.id,
					email: user.email,
					name: user.name,
					role: user.role,
				},
				accessToken,
				refreshToken,
			};
		} catch (error: unknown) {
			if (isZodError(error)) {
				return reply
					.status(400)
					.send({ error: "Validation failed", details: error.issues });
			}
			console.error("Login error:", error);
			return reply.status(500).send({ error: "Login failed" });
		}
	});

	// Refresh token
	fastify.post("/refresh", async (request, reply) => {
		try {
			const { refreshToken } = request.body as { refreshToken: string };

			if (!refreshToken) {
				return reply.status(400).send({ error: "Refresh token required" });
			}

			const session = sessionQueries.findByToken.get(refreshToken);
			if (!session) {
				return reply.status(401).send({ error: "Invalid refresh token" });
			}

			if (new Date(session.expires_at) < new Date()) {
				sessionQueries.delete.run(session.id);
				return reply.status(401).send({ error: "Refresh token expired" });
			}

			const user = userQueries.findById.get(session.user_id);
			if (!user) {
				return reply.status(401).send({ error: "User not found" });
			}

			// Generate new access token
			const accessToken = fastify.jwt.sign(
				{ id: user.id, email: user.email, role: user.role },
				{ expiresIn: "15m" },
			);

			return { accessToken };
		} catch (error) {
			console.error("Refresh error:", error);
			return reply.status(500).send({ error: "Token refresh failed" });
		}
	});

	// Logout
	fastify.post(
		"/logout",
		{ preHandler: [fastify.authenticate] },
		async (request, reply) => {
			try {
				const { refreshToken } = request.body as { refreshToken?: string };
				const user = request.user as AuthUser;

				if (refreshToken) {
					const session = sessionQueries.findByToken.get(refreshToken);
					if (session && session.user_id === user.id) {
						sessionQueries.delete.run(session.id);
					}
				} else {
					// Logout all sessions
					sessionQueries.deleteByUser.run(user.id);
				}

				return { success: true };
			} catch (error) {
				console.error("Logout error:", error);
				return reply.status(500).send({ error: "Logout failed" });
			}
		},
	);

	// Get current user
	fastify.get(
		"/me",
		{ preHandler: [fastify.authenticate] },
		async (request) => {
			const authUser = request.user as AuthUser;
			const user = userQueries.findById.get(authUser.id);

			if (!user) {
				return { error: "User not found" };
			}

			return {
				id: user.id,
				email: user.email,
				name: user.name,
				role: user.role,
				createdAt: user.created_at,
			};
		},
	);
}
