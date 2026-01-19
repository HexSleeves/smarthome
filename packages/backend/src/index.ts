import "dotenv/config";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import Fastify from "fastify";

import { config } from "./config.js";
import { db } from "./db/schema.js";
import { createLoggerConfig } from "./logger.js";
import { authMiddleware } from "./middleware/auth.js";
import { ringSnapshotRoutes } from "./routes/ring-snapshot.js";
import { websocketRoutes } from "./routes/websocket.js";
import { ringService } from "./services/ring.js";
import { roborockService } from "./services/roborock.js";
import { reconnectStoredCredentials } from "./startup.js";
import { registerTRPC } from "./trpc/fastify-adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const fastify = Fastify({ logger: createLoggerConfig(config) });

declare module "fastify" {
	interface FastifyInstance {
		authenticate: typeof authMiddleware;
	}
}

async function main() {
	await fastify.register(helmet, { contentSecurityPolicy: false });

	await fastify.register(rateLimit, {
		global: true,
		max: 100,
		timeWindow: "1 minute",
		addHeadersOnExceeding: {
			"x-ratelimit-limit": true,
			"x-ratelimit-remaining": true,
			"x-ratelimit-reset": true,
		},
	});

	const corsOrigin = config.CORS_ORIGIN
		? config.CORS_ORIGIN.split(",").map((o) => o.trim())
		: config.NODE_ENV !== "production";

	await fastify.register(cors, { origin: corsOrigin, credentials: true });
	await fastify.register(formbody);
	await fastify.register(cookie, { secret: config.COOKIE_SECRET });
	await fastify.register(jwt, { secret: config.JWT_SECRET });
	await fastify.register(websocket);

	fastify.decorate("authenticate", authMiddleware);

	// Routes
	await fastify.register(ringSnapshotRoutes, { prefix: "/api/ring" });
	await fastify.register(websocketRoutes, { prefix: "/api/ws" });
	await registerTRPC(fastify);

	fastify.get("/api/health", async () => ({
		status: "ok",
		timestamp: new Date().toISOString(),
	}));

	// Serve frontend
	const frontendDist = join(__dirname, "../../frontend/dist");
	if (existsSync(frontendDist)) {
		await fastify.register(fastifyStatic, { root: frontendDist, prefix: "/" });
		fastify.setNotFoundHandler(async (request, reply) => {
			if (request.url.startsWith("/api")) {
				return reply.status(404).send({ error: "Not found" });
			}
			return reply.sendFile("index.html");
		});
	}

	try {
		await fastify.listen({ port: config.PORT, host: config.HOST });
		fastify.log.info(`Server running at http://${config.HOST}:${config.PORT}`);
		reconnectStoredCredentials(fastify).catch((err) =>
			fastify.log.error(err, "Failed to reconnect stored credentials"),
		);
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
}

const shutdown = async (signal: string) => {
	fastify.log.info(`Received ${signal}, shutting down...`);
	try {
		await fastify.close();
		roborockService.shutdown();
		ringService.shutdown();
		db.close();
		fastify.log.info("Shutdown complete");
		process.exit(0);
	} catch (err) {
		fastify.log.error(err, "Error during shutdown");
		process.exit(1);
	}
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main();
