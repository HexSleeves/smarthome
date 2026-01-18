import * as argon2 from "argon2";
import { TRPCError } from "@trpc/server";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { createUser, sessionQueries, userQueries } from "../../db/queries.js";
import { protectedProcedure, publicProcedure, router } from "../trpc.js";
import type { TRPCContext } from "../trpc.js";

const registerSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8, "Password must be at least 8 characters"),
	name: z.string().optional(),
});

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string(),
});

const refreshSchema = z.object({
	refreshToken: z.string(),
});

const logoutSchema = z.object({
	refreshToken: z.string().optional(),
});

// Helper to generate tokens
function generateTokens(
	ctx: TRPCContext,
	user: { id: string; email: string; role: string },
): { accessToken: string; refreshToken: string; expiresAt: string } {
	// Access token via fastify.jwt
	const accessToken = (ctx.req.server as { jwt: { sign: (payload: object, options?: object) => string } }).jwt.sign(
		{ id: user.id, email: user.email, role: user.role },
		{ expiresIn: "15m" },
	);

	const refreshToken = uuid();
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

	return { accessToken, refreshToken, expiresAt };
}

export const authRouter = router({
	register: publicProcedure
		.input(registerSchema)
		.mutation(async ({ input, ctx }) => {
			// Check if user exists
			const existing = userQueries.findByEmail.get(input.email);
			if (existing) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Email already registered",
				});
			}

			// Hash password
			const passwordHash = await argon2.hash(input.password);

			// First user becomes admin
			const users = userQueries.list.all();
			const role = users.length === 0 ? "admin" : "viewer";

			// Create user
			const user = createUser(input.email, passwordHash, input.name, role);

			// Generate tokens
			const { accessToken, refreshToken, expiresAt } = generateTokens(ctx, user);

			sessionQueries.create.run(
				uuid(),
				user.id,
				refreshToken,
				ctx.req.headers["user-agent"] || null,
				ctx.req.ip,
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
		}),

	login: publicProcedure
		.input(loginSchema)
		.mutation(async ({ input, ctx }) => {
			const user = userQueries.findByEmail.get(input.email);
			if (!user) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "Invalid credentials",
				});
			}

			const validPassword = await argon2.verify(
				user.password_hash,
				input.password,
			);
			if (!validPassword) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "Invalid credentials",
				});
			}

			// Generate tokens
			const { accessToken, refreshToken, expiresAt } = generateTokens(ctx, user);

			sessionQueries.create.run(
				uuid(),
				user.id,
				refreshToken,
				ctx.req.headers["user-agent"] || null,
				ctx.req.ip,
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
		}),

	refresh: publicProcedure
		.input(refreshSchema)
		.mutation(async ({ input, ctx }) => {
			const session = sessionQueries.findByToken.get(input.refreshToken);
			if (!session) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "Invalid refresh token",
				});
			}

			if (new Date(session.expires_at) < new Date()) {
				sessionQueries.delete.run(session.id);
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "Refresh token expired",
				});
			}

			const user = userQueries.findById.get(session.user_id);
			if (!user) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "User not found",
				});
			}

			// Generate new access token
			const accessToken = (ctx.req.server as { jwt: { sign: (payload: object, options?: object) => string } }).jwt.sign(
				{ id: user.id, email: user.email, role: user.role },
				{ expiresIn: "15m" },
			);

			return { accessToken };
		}),

	logout: protectedProcedure
		.input(logoutSchema)
		.mutation(async ({ input, ctx }) => {
			if (input.refreshToken) {
				const session = sessionQueries.findByToken.get(input.refreshToken);
				if (session && session.user_id === ctx.user.id) {
					sessionQueries.delete.run(session.id);
				}
			} else {
				// Logout all sessions
				sessionQueries.deleteByUser.run(ctx.user.id);
			}

			return { success: true };
		}),

	me: protectedProcedure.query(async ({ ctx }) => {
		const user = userQueries.findById.get(ctx.user.id);

		if (!user) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "User not found",
			});
		}

		return {
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			createdAt: user.created_at,
		};
	}),
});
