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
import { authMiddleware } from "./middleware/auth.js";
import { authRoutes } from "./routes/auth.js";
import { deviceRoutes } from "./routes/devices.js";
import { ringRoutes } from "./routes/ring.js";
import { roborockRoutes } from "./routes/roborock.js";
import { websocketRoutes } from "./routes/websocket.js";
import { ringService } from "./services/ring.js";
import { roborockService } from "./services/roborock.js";
import { registerTRPC } from "./trpc/fastify-adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const fastify = Fastify({
	logger: {
		level: config.LOG_LEVEL,
	},
});

// Extend Fastify with auth decorator
declare module "fastify" {
	interface FastifyInstance {
		authenticate: typeof authMiddleware;
	}
}

async function main() {
	// Security headers
	await fastify.register(helmet, {
		contentSecurityPolicy: false, // Disable for SPA
	});

	// Rate limiting - global with per-route overrides
	await fastify.register(rateLimit, {
		global: true,
		max: 100,
		timeWindow: "1 minute",
		// Allow per-route config overrides
		addHeadersOnExceeding: {
			"x-ratelimit-limit": true,
			"x-ratelimit-remaining": true,
			"x-ratelimit-reset": true,
		},
	});

	// CORS - explicit origins in production
	const corsOrigin = config.CORS_ORIGIN
		? config.CORS_ORIGIN.split(",").map((o) => o.trim())
		: config.NODE_ENV === "production"
			? false // Block all in production if not configured
			: true; // Allow all in development

	await fastify.register(cors, {
		origin: corsOrigin,
		credentials: true,
	});

	await fastify.register(formbody);

	await fastify.register(cookie, {
		secret: config.COOKIE_SECRET,
	});

	await fastify.register(jwt, {
		secret: config.JWT_SECRET,
	});

	await fastify.register(websocket);

	// Add auth decorator
	fastify.decorate("authenticate", authMiddleware);

	// API routes (REST - will be deprecated in favor of tRPC)
	await fastify.register(authRoutes, { prefix: "/api/auth" });

	await fastify.register(deviceRoutes, { prefix: "/api/devices" });
	await fastify.register(roborockRoutes, { prefix: "/api/roborock" });
	await fastify.register(ringRoutes, { prefix: "/api/ring" });
	await fastify.register(websocketRoutes, { prefix: "/api/ws" });

	// tRPC routes
	await registerTRPC(fastify);

	// Health check
	fastify.get("/api/health", async () => {
		return { status: "ok", timestamp: new Date().toISOString() };
	});

	// Serve frontend in production
	const frontendDist = join(__dirname, "../../frontend/dist");
	if (existsSync(frontendDist)) {
		await fastify.register(fastifyStatic, {
			root: frontendDist,
			prefix: "/",
		});

		// SPA fallback
		fastify.setNotFoundHandler(async (request, reply) => {
			if (request.url.startsWith("/api")) {
				return reply.status(404).send({ error: "Not found" });
			}
			return reply.sendFile("index.html");
		});
	} else {
		fastify.get("/", async () => {
			return { message: "Smart Home API", docs: "/api/health" };
		});
	}

	// Start server
	try {
		await fastify.listen({ port: config.PORT, host: config.HOST });
		fastify.log.info(`Server running at http://${config.HOST}:${config.PORT}`);
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
}

// Graceful shutdown
const shutdown = async (signal: string) => {
	fastify.log.info(`Received ${signal}, shutting down gracefully...`);

	try {
		// Stop accepting new connections
		await fastify.close();
		fastify.log.info("HTTP server closed");

		// Cleanup services
		roborockService.shutdown();
		ringService.shutdown();
		fastify.log.info("Services shut down");

		// Close database
		db.close();
		fastify.log.info("Database connection closed");

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
