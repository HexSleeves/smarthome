import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AuthUser } from "../middleware/auth.js";
import { roborockService } from "../services/roborock.js";
import { credentialQueries } from "../db/queries.js";

const authSchema = z.object({
	email: z.string().email(),
	password: z.string(),
});

const commandSchema = z.object({
	command: z.enum(["start", "stop", "pause", "home", "find"]),
});

const fanSpeedSchema = z.object({
	speed: z.enum(["quiet", "balanced", "turbo", "max"]),
});

const waterLevelSchema = z.object({
	level: z.enum(["off", "low", "medium", "high"]),
});

const roomCleanSchema = z.object({
	roomIds: z.array(z.number()),
});

export async function roborockRoutes(fastify: FastifyInstance) {
	// Require auth for all routes
	fastify.addHook("preHandler", fastify.authenticate);

	// Check connection status
	fastify.get("/status", async (request) => {
		const user = request.user as AuthUser;
		const connected = roborockService.isConnected(user.id);
		const hasCredentials = !!credentialQueries.findByProvider.get(
			user.id,
			"roborock",
		);

		return { connected, hasCredentials };
	});

	// Authenticate with Roborock
	fastify.post("/auth", async (request, reply) => {
		const user = request.user as AuthUser;

		try {
			const body = authSchema.parse(request.body);
			const result = await roborockService.authenticate(
				user.id,
				body.email,
				body.password,
			);

			if (!result.success) {
				return reply.status(400).send({ error: result.error });
			}

			return { success: true };
		} catch (error: any) {
			if (error instanceof z.ZodError) {
				return reply
					.status(400)
					.send({ error: "Validation failed", details: error.errors });
			}
			return reply.status(500).send({ error: "Authentication failed" });
		}
	});

	// Connect with stored credentials
	fastify.post("/connect", async (request, reply) => {
		const user = request.user as AuthUser;

		const success = await roborockService.connectWithStoredCredentials(user.id);
		if (!success) {
			return reply
				.status(400)
				.send({ error: "Failed to connect. Please re-authenticate." });
		}

		return { success: true };
	});

	// Disconnect
	fastify.post("/disconnect", async (request) => {
		const user = request.user as AuthUser;
		roborockService.disconnect(user.id);
		return { success: true };
	});

	// Get all Roborock devices
	fastify.get("/devices", async (request, reply) => {
		const user = request.user as AuthUser;

		if (!roborockService.isConnected(user.id)) {
			// Try to reconnect
			const connected = await roborockService.connectWithStoredCredentials(
				user.id,
			);
			if (!connected) {
				return reply.status(401).send({ error: "Not connected to Roborock" });
			}
		}

		const devices = await roborockService.getDevices(user.id);
		return { devices };
	});

	// Send command to device
	fastify.post("/devices/:deviceId/command", async (request, reply) => {
		const user = request.user as AuthUser;
		const { deviceId } = request.params as { deviceId: string };

		if (user.role !== "admin") {
			return reply
				.status(403)
				.send({ error: "Admin access required for commands" });
		}

		if (!roborockService.isConnected(user.id)) {
			return reply.status(401).send({ error: "Not connected to Roborock" });
		}

		try {
			const body = commandSchema.parse(request.body);
			let success = false;

			switch (body.command) {
				case "start":
					success = await roborockService.startCleaning(user.id, deviceId);
					break;
				case "stop":
					success = await roborockService.stopCleaning(user.id, deviceId);
					break;
				case "pause":
					success = await roborockService.pauseCleaning(user.id, deviceId);
					break;
				case "home":
					success = await roborockService.returnHome(user.id, deviceId);
					break;
				case "find":
					success = await roborockService.findRobot(user.id, deviceId);
					break;
			}

			if (!success) {
				return reply.status(500).send({ error: "Command failed" });
			}

			return { success: true };
		} catch (error: any) {
			if (error instanceof z.ZodError) {
				return reply
					.status(400)
					.send({ error: "Invalid command", details: error.errors });
			}
			return reply.status(500).send({ error: "Command failed" });
		}
	});

	// Set fan speed
	fastify.post("/devices/:deviceId/fan-speed", async (request, reply) => {
		const user = request.user as AuthUser;
		const { deviceId } = request.params as { deviceId: string };

		if (user.role !== "admin") {
			return reply.status(403).send({ error: "Admin access required" });
		}

		try {
			const body = fanSpeedSchema.parse(request.body);
			const success = await roborockService.setFanSpeed(
				user.id,
				deviceId,
				body.speed,
			);

			if (!success) {
				return reply.status(500).send({ error: "Failed to set fan speed" });
			}

			return { success: true };
		} catch (error: any) {
			if (error instanceof z.ZodError) {
				return reply
					.status(400)
					.send({ error: "Validation failed", details: error.errors });
			}
			return reply.status(500).send({ error: "Failed to set fan speed" });
		}
	});

	// Set water level
	fastify.post("/devices/:deviceId/water-level", async (request, reply) => {
		const user = request.user as AuthUser;
		const { deviceId } = request.params as { deviceId: string };

		if (user.role !== "admin") {
			return reply.status(403).send({ error: "Admin access required" });
		}

		try {
			const body = waterLevelSchema.parse(request.body);
			const success = await roborockService.setWaterLevel(
				user.id,
				deviceId,
				body.level,
			);

			if (!success) {
				return reply.status(500).send({ error: "Failed to set water level" });
			}

			return { success: true };
		} catch (error: any) {
			if (error instanceof z.ZodError) {
				return reply
					.status(400)
					.send({ error: "Validation failed", details: error.errors });
			}
			return reply.status(500).send({ error: "Failed to set water level" });
		}
	});

	// Clean specific rooms
	fastify.post("/devices/:deviceId/clean-rooms", async (request, reply) => {
		const user = request.user as AuthUser;
		const { deviceId } = request.params as { deviceId: string };

		if (user.role !== "admin") {
			return reply.status(403).send({ error: "Admin access required" });
		}

		try {
			const body = roomCleanSchema.parse(request.body);
			const success = await roborockService.cleanRooms(
				user.id,
				deviceId,
				body.roomIds,
			);

			if (!success) {
				return reply
					.status(500)
					.send({ error: "Failed to start room cleaning" });
			}

			return { success: true };
		} catch (error: any) {
			if (error instanceof z.ZodError) {
				return reply
					.status(400)
					.send({ error: "Validation failed", details: error.errors });
			}
			return reply.status(500).send({ error: "Failed to start room cleaning" });
		}
	});

	// Get cleaning history
	fastify.get("/devices/:deviceId/history", async (request, reply) => {
		const user = request.user as AuthUser;
		const { deviceId } = request.params as { deviceId: string };

		if (!roborockService.isConnected(user.id)) {
			return reply.status(401).send({ error: "Not connected to Roborock" });
		}

		const history = await roborockService.getCleanHistory(user.id, deviceId);
		return { history };
	});

	// Get map (if available)
	fastify.get("/devices/:deviceId/map", async (request, reply) => {
		const user = request.user as AuthUser;
		const { deviceId } = request.params as { deviceId: string };

		if (!roborockService.isConnected(user.id)) {
			return reply.status(401).send({ error: "Not connected to Roborock" });
		}

		const map = await roborockService.getMap(user.id, deviceId);
		if (!map) {
			return reply.status(404).send({ error: "Map not available" });
		}

		return { map };
	});
}
