import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
			const user = request.user;
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

	// HLS stream file serving
	fastify.get<{
		Params: { sessionId: string; filename: string };
		Querystring: { token?: string };
	}>(
		"/stream/:sessionId/:filename",
		{
			preHandler: async (request, reply) => {
				// Try query param token first
				const { token } = request.query;
				if (token) {
					try {
						request.user = fastify.jwt.verify<JwtPayload>(token);
						return;
					} catch {
						return reply.status(401).send({ error: "Invalid token" });
					}
				}
				// Try Authorization header
				const authHeader = request.headers.authorization;
				if (authHeader?.startsWith("Bearer ")) {
					try {
						const bearerToken = authHeader.substring(7);
						request.user = fastify.jwt.verify<JwtPayload>(bearerToken);
						return;
					} catch {
						return reply.status(401).send({ error: "Invalid token" });
					}
				}
				// Try cookie-based JWT
				try {
					await request.jwtVerify();
				} catch {
					return reply.status(401).send({ error: "Unauthorized" });
				}
			},
		},
		async (request, reply) => {
			const { sessionId, filename } = request.params;

			// Validate filename to prevent path traversal
			if (filename.includes("..") || filename.includes("/")) {
				return reply.status(400).send({ error: "Invalid filename" });
			}

			// Get the output directory for this session
			const outputDir = ringService.getStreamOutputDir(sessionId);
			if (!outputDir) {
				return reply.status(404).send({ error: "Stream not found" });
			}

			const filePath = join(outputDir, filename);

			if (!existsSync(filePath)) {
				return reply.status(404).send({ error: "File not found" });
			}

			// Update stream activity
			ringService.touchStream(sessionId);

			// Determine content type
			let contentType = "application/octet-stream";
			if (filename.endsWith(".m3u8")) {
				contentType = "application/vnd.apple.mpegurl";
			} else if (filename.endsWith(".ts")) {
				contentType = "video/mp2t";
			}

			reply.header("Content-Type", contentType);
			reply.header("Cache-Control", "no-cache");
			reply.header("Access-Control-Allow-Origin", "*");

			const fileContent = readFileSync(filePath);
			return reply.send(fileContent);
		},
	);
}
