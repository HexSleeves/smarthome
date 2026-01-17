import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import formbody from "@fastify/formbody";
import cookie from "@fastify/cookie";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

import "./db/schema.js"; // Initialize database
import { authRoutes } from "./routes/auth.js";
import { deviceRoutes } from "./routes/devices.js";
import { roborockRoutes } from "./routes/roborock.js";
import { ringRoutes } from "./routes/ring.js";
import { websocketRoutes } from "./routes/websocket.js";
import { authMiddleware, AuthUser } from "./middleware/auth.js";

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

	// API routes
	await fastify.register(authRoutes, { prefix: "/api/auth" });
	await fastify.register(deviceRoutes, { prefix: "/api/devices" });
	await fastify.register(roborockRoutes, { prefix: "/api/roborock" });
	await fastify.register(ringRoutes, { prefix: "/api/ring" });
	await fastify.register(websocketRoutes, { prefix: "/api/ws" });

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
