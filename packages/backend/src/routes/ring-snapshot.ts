import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AuthUser } from "../middleware/auth.js";
import { ringService } from "../services/ring.js";
import type { JwtPayload } from "../types.js";

// Route type definitions
interface DeviceIdParams {
	deviceId: string;
}

interface TokenQuery {
	token?: string;
}

// Helper to get typed user from request
function getUser(request: FastifyRequest): AuthUser {
	return request.user as AuthUser;
}

/**
 * Ring snapshot route - kept as REST because it's used in <img src> tags
 * which require a URL with query string token.
 */
export async function ringSnapshotRoutes(fastify: FastifyInstance) {
	// Get device snapshot - special handling for token in query string (for img src)
	fastify.get<{ Params: DeviceIdParams; Querystring: TokenQuery }>(
		"/devices/:deviceId/snapshot",
		{
			preHandler: async (request, reply) => {
				// Try to get token from query string first (for img src URLs)
				const { token } = request.query;

				if (token) {
					try {
						const decoded = fastify.jwt.verify<JwtPayload>(token);
						request.user = decoded;
						return;
					} catch (_err) {
						return reply.status(401).send({ error: "Invalid token" });
					}
				}

				// Fall back to Authorization header
				try {
					await request.jwtVerify();
				} catch (_err) {
					return reply.status(401).send({ error: "Unauthorized" });
				}
			},
		},
		async (request, reply) => {
			const user = getUser(request);
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
