import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AuthUser } from "../middleware/auth.js";
import { ringService } from "../services/ring.js";
import type { JwtPayload } from "../types.js";

export async function ringSnapshotRoutes(fastify: FastifyInstance) {
	fastify.get<{
		Params: { deviceId: string };
		Querystring: { token?: string };
	}>(
		"/devices/:deviceId/snapshot",
		{
			preHandler: async (request, reply) => {
				const { token } = request.query;
				if (token) {
					try {
						request.user = fastify.jwt.verify<JwtPayload>(token);
						return;
					} catch {
						return reply.status(401).send({ error: "Invalid token" });
					}
				}
				try {
					await request.jwtVerify();
				} catch {
					return reply.status(401).send({ error: "Unauthorized" });
				}
			},
		},
		async (request, reply) => {
			const user = request.user as AuthUser;
			const { deviceId } = request.params;

			if (!ringService.isConnected(user.id)) {
				return reply.status(401).send({ error: "Not connected to Ring" });
			}

			const snapshot = await ringService.getSnapshot(user.id, deviceId);
			if (!snapshot) {
				return reply.status(404).send({ error: "Snapshot not available" });
			}

			reply.header("Content-Type", "image/jpeg");
			reply.header("Cache-Control", "no-cache");
			return reply.send(snapshot);
		},
	);
}
