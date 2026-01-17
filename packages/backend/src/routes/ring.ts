import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AuthUser } from "../middleware/auth.js";
import { ringService } from "../services/ring.js";
import { credentialQueries } from "../db/queries.js";

const authSchema = z.object({
	email: z.string().email().optional(),
	password: z.string().optional(),
	twoFactorCode: z.string().optional(),
});

const twoFactorSchema = z.object({
	code: z.string().min(4).max(10),
});

export async function ringRoutes(fastify: FastifyInstance) {
	// Require auth for all routes
	fastify.addHook("preHandler", fastify.authenticate);

	// Check connection status
	fastify.get("/status", async (request) => {
		const user = request.user as AuthUser;
		const connected = ringService.isConnected(user.id);
		const hasCredentials = !!credentialQueries.findByProvider.get(
			user.id,
			"ring",
		);
		const pending2FA = ringService.hasPending2FA(user.id);

		return { connected, hasCredentials, pending2FA };
	});

	// Authenticate with Ring (initial login)
	fastify.post("/auth", async (request, reply) => {
		const user = request.user as AuthUser;

		try {
			const body = authSchema.parse(request.body);

			// If only twoFactorCode provided, use the 2FA submission endpoint logic
			if (body.twoFactorCode && !body.email && !body.password) {
				const result = await ringService.submitTwoFactorCode(
					user.id,
					body.twoFactorCode,
				);

				if (!result.success) {
					return reply.status(400).send({ error: result.error });
				}
				return { success: true };
			}

			// Normal auth with email/password (and optionally 2FA code)
			if (!body.email || !body.password) {
				return reply
					.status(400)
					.send({ error: "Email and password are required" });
			}

			console.log("Calling ringService.authenticate...");
			const result = await ringService.authenticate(
				user.id,
				body.email,
				body.password,
				body.twoFactorCode,
			);
			console.log("ringService.authenticate returned:", JSON.stringify(result));

			if (!result.success) {
				if (result.requiresTwoFactor) {
					console.log("Returning 2FA required response");
					return reply.status(200).send({
						success: false,
						requiresTwoFactor: true,
						prompt:
							result.prompt || "Please enter the 2FA code sent to your phone.",
					});
				}
				return reply.status(400).send({ error: result.error });
			}

			return { success: true };
		} catch (error: any) {
			console.error("Route catch block - error:", error.message || error);
			if (error instanceof z.ZodError) {
				return reply
					.status(400)
					.send({ error: "Validation failed", details: error.errors });
			}
			return reply.status(500).send({ error: "Authentication failed" });
		}
	});

	// Submit 2FA code (after initial auth triggered SMS)
	fastify.post("/auth/2fa", async (request, reply) => {
		const user = request.user as AuthUser;

		try {
			const body = twoFactorSchema.parse(request.body);

			if (!ringService.hasPending2FA(user.id)) {
				return reply.status(400).send({
					error:
						"No pending authentication. Please enter email and password first.",
				});
			}

			const result = await ringService.submitTwoFactorCode(user.id, body.code);

			if (!result.success) {
				// If still requires 2FA, it means the code was invalid - allow retry
				if (result.requiresTwoFactor) {
					return reply.status(400).send({
						error:
							result.prompt ||
							result.error ||
							"Invalid code. Please try again.",
						canRetry: true,
					});
				}
				return reply.status(400).send({ error: result.error });
			}

			return { success: true };
		} catch (error: any) {
			if (error instanceof z.ZodError) {
				return reply.status(400).send({ error: "Invalid code format" });
			}
			return reply.status(500).send({ error: "Verification failed" });
		}
	});

	// Cancel pending 2FA
	fastify.post("/auth/2fa/cancel", async (request) => {
		const user = request.user as AuthUser;
		ringService.cancelPending2FA(user.id);
		return { success: true };
	});

	// Connect with stored credentials
	fastify.post("/connect", async (request, reply) => {
		const user = request.user as AuthUser;

		const success = await ringService.connectWithStoredCredentials(user.id);
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
		ringService.disconnect(user.id);
		return { success: true };
	});

	// Get all Ring devices
	fastify.get("/devices", async (request, reply) => {
		const user = request.user as AuthUser;

		if (!ringService.isConnected(user.id)) {
			// Try to reconnect
			const connected = await ringService.connectWithStoredCredentials(user.id);
			if (!connected) {
				return reply.status(401).send({ error: "Not connected to Ring" });
			}
		}

		const devices = await ringService.getDevices(user.id);
		return { devices };
	});

	// Get device snapshot - special handling for token in query string (for img src)
	fastify.get(
		"/devices/:deviceId/snapshot",
		{
			// Skip the normal auth hook - we'll handle it manually
			preHandler: async (request, reply) => {
				// Try to get token from query string first (for img src URLs)
				const { token } = request.query as { token?: string };

				if (token) {
					try {
						const decoded = fastify.jwt.verify(token) as AuthUser;
						request.user = decoded;
						return;
					} catch (err) {
						return reply.status(401).send({ error: "Invalid token" });
					}
				}

				// Fall back to Authorization header
				try {
					await request.jwtVerify();
				} catch (err) {
					return reply.status(401).send({ error: "Unauthorized" });
				}
			},
		},
		async (request, reply) => {
			const user = request.user as AuthUser;
			const { deviceId } = request.params as { deviceId: string };

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

	// Get live stream URL
	fastify.get("/devices/:deviceId/stream", async (request, reply) => {
		const user = request.user as AuthUser;
		const { deviceId } = request.params as { deviceId: string };

		if (!ringService.isConnected(user.id)) {
			return reply.status(401).send({ error: "Not connected to Ring" });
		}

		const streamUrl = await ringService.getLiveStreamUrl(user.id, deviceId);
		if (!streamUrl) {
			return reply.status(404).send({ error: "Stream not available" });
		}

		return { streamUrl };
	});

	// Get event history
	fastify.get("/devices/:deviceId/history", async (request, reply) => {
		const user = request.user as AuthUser;
		const { deviceId } = request.params as { deviceId: string };
		const { limit = 20 } = request.query as { limit?: number };

		if (!ringService.isConnected(user.id)) {
			return reply.status(401).send({ error: "Not connected to Ring" });
		}

		const history = await ringService.getHistory(
			user.id,
			deviceId,
			Math.min(limit, 100),
		);
		return { history };
	});

	// Toggle light
	fastify.post("/devices/:deviceId/light", async (request, reply) => {
		const user = request.user as AuthUser;
		const { deviceId } = request.params as { deviceId: string };
		const { on } = request.body as { on: boolean };

		if (user.role !== "admin") {
			return reply.status(403).send({ error: "Admin access required" });
		}

		if (!ringService.isConnected(user.id)) {
			return reply.status(401).send({ error: "Not connected to Ring" });
		}

		const success = await ringService.toggleLight(user.id, deviceId, on);
		if (!success) {
			return reply.status(500).send({ error: "Failed to toggle light" });
		}

		return { success: true };
	});

	// Trigger siren
	fastify.post("/devices/:deviceId/siren", async (request, reply) => {
		const user = request.user as AuthUser;
		const { deviceId } = request.params as { deviceId: string };

		if (user.role !== "admin") {
			return reply.status(403).send({ error: "Admin access required" });
		}

		if (!ringService.isConnected(user.id)) {
			return reply.status(401).send({ error: "Not connected to Ring" });
		}

		const success = await ringService.triggerSiren(user.id, deviceId);
		if (!success) {
			return reply.status(500).send({ error: "Failed to trigger siren" });
		}

		return { success: true };
	});
}
