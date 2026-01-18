import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { User } from "@smarthome/shared";

export type SignJwtFn = (payload: object, options?: { expiresIn?: string }) => string;

export type TRPCContext = {
	req: FastifyRequest;
	res: FastifyReply;
	user: User | null;
	signJwt: SignJwtFn;
};

const t = initTRPC.context<TRPCContext>().create({
	transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

// Auth middleware
const isAuthed = middleware(async ({ ctx, next }) => {
	if (!ctx.user) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return next({
		ctx: {
			...ctx,
			user: ctx.user,
		},
	});
});

const isAdmin = middleware(async ({ ctx, next }) => {
	if (!ctx.user) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	if (ctx.user.role !== "admin") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Admin access required",
		});
	}
	return next({
		ctx: {
			...ctx,
			user: ctx.user,
		},
	});
});

export const protectedProcedure = t.procedure.use(isAuthed);
export const adminProcedure = t.procedure.use(isAdmin);
