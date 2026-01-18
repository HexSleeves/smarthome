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

				// Extract user from JWT
				const authHeader = req.headers.authorization;
				if (authHeader?.startsWith("Bearer ")) {
					const token = authHeader.substring(7);
					try {
						const decoded = fastify.jwt.verify<User>(token);
						user = {
							id: decoded.id,
							email: decoded.email,
							name: decoded.name,
							role: decoded.role,
						};
					} catch {
						// Invalid token, user remains null
					}
				}

				return { req, res, user };
			},
		},
	});
}
