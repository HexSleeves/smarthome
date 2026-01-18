import { TRPCError } from "@trpc/server";
import * as argon2 from "argon2";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { createUser, sessionQueries, userQueries } from "../../db/queries.js";
import {
	protectedProcedure,
	publicProcedure,
	router,
	type TRPCContext,
} from "../trpc.js";

function generateTokens(
	ctx: TRPCContext,
	user: { id: string; email: string; role: string },
) {
	const accessToken = ctx.signJwt(
		{ id: user.id, email: user.email, role: user.role },
		{ expiresIn: "15m" },
	);
	const refreshToken = uuid();
	const expiresAt = new Date(
		Date.now() + 7 * 24 * 60 * 60 * 1000,
	).toISOString();
	return { accessToken, refreshToken, expiresAt };
}

export const authRouter = router({
	register: publicProcedure
		.input(
			z.object({
				email: z.string().email(),
				password: z.string().min(8),
				name: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (userQueries.findByEmail.get(input.email)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Email already registered",
				});
			}

			const passwordHash = await argon2.hash(input.password);
			const role = userQueries.list.all().length === 0 ? "admin" : "viewer";
			const user = createUser(input.email, passwordHash, input.name, role);
			const { accessToken, refreshToken, expiresAt } = generateTokens(
				ctx,
				user,
			);

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
		.input(z.object({ email: z.string().email(), password: z.string() }))
		.mutation(async ({ input, ctx }) => {
			const user = userQueries.findByEmail.get(input.email);
			if (!user || !(await argon2.verify(user.password_hash, input.password))) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "Invalid credentials",
				});
			}

			const { accessToken, refreshToken, expiresAt } = generateTokens(
				ctx,
				user,
			);

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
		.input(z.object({ refreshToken: z.string() }))
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

			const accessToken = ctx.signJwt(
				{ id: user.id, email: user.email, role: user.role },
				{ expiresIn: "15m" },
			);
			return { accessToken };
		}),

	logout: protectedProcedure
		.input(z.object({ refreshToken: z.string().optional() }))
		.mutation(async ({ input, ctx }) => {
			if (input.refreshToken) {
				const session = sessionQueries.findByToken.get(input.refreshToken);
				if (session?.user_id === ctx.user.id) {
					sessionQueries.delete.run(session.id);
				}
			} else {
				sessionQueries.deleteByUser.run(ctx.user.id);
			}
			return { success: true };
		}),

	me: protectedProcedure.query(async ({ ctx }) => {
		const user = userQueries.findById.get(ctx.user.id);
		if (!user) {
			throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
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
