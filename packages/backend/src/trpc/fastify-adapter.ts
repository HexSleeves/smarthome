import type { User } from "@smarthome/shared";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { appRouter } from "./routers/index.js";
import type { TRPCContext } from "./trpc.js";

export async function registerTRPC(fastify: FastifyInstance) {
	await fastify.register(fastifyTRPCPlugin, {
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
						const decoded = fastify.jwt.verify<User>(authHeader.slice(7));
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
					(fastify.jwt.sign as (p: unknown, o?: unknown) => string)(
						payload,
						options,
					);

				return { req, res, user, signJwt };
			},
		},
	});
}
