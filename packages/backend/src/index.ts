import "dotenv/config";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import jwt from "@fastify/jwt";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import "./db/schema.js"; // Initialize database
import { AuthUser, authMiddleware } from "./middleware/auth.js";
import { authRoutes } from "./routes/auth.js";
import { deviceRoutes } from "./routes/devices.js";
import { ringRoutes } from "./routes/ring.js";
import { roborockRoutes } from "./routes/roborock.js";
import { websocketRoutes } from "./routes/websocket.js";
import { registerTRPC } from "./trpc/fastify-adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const fastify = Fastify({
	logger: {
		level: process.env.LOG_LEVEL || "info",
	},
});

// Extend Fastify with auth decorator
declare module "fastify" {
	interface FastifyInstance {
		authenticate: typeof authMiddleware;
	}
}

async function main() {
	// Register plugins
	await fastify.register(cors, {
		origin: process.env.CORS_ORIGIN || true,
		credentials: true,
	});

	await fastify.register(formbody);

	await fastify.register(cookie, {
		secret: process.env.COOKIE_SECRET || "cookie-secret-change-in-production",
	});

	await fastify.register(jwt, {
		secret: process.env.JWT_SECRET || "jwt-secret-change-in-production",
	});

	await fastify.register(websocket);

	// Add auth decorator
	fastify.decorate("authenticate", authMiddleware);

	// API routes (REST - will be deprecated)
	await fastify.register(authRoutes, { prefix: "/api/auth" });
	await fastify.register(deviceRoutes, { prefix: "/api/devices" });
	await fastify.register(roborockRoutes, { prefix: "/api/roborock" });
	await fastify.register(ringRoutes, { prefix: "/api/ring" });
	await fastify.register(websocketRoutes, { prefix: "/api/ws" });

	// tRPC routes (new)
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
	const port = parseInt(process.env.PORT || "8000", 10);
	const host = process.env.HOST || "0.0.0.0";

	try {
		await fastify.listen({ port, host });
		console.log(`Server running at http://${host}:${port}`);
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
}

main();
