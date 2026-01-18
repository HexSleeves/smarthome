import type { FastifyInstance, FastifyRequest } from "fastify";
import { deviceQueries, type Event, eventQueries } from "../db/queries.js";
import type { AuthUser } from "../middleware/auth.js";
import { ringService } from "../services/ring.js";
import { roborockService } from "../services/roborock.js";

// Route type definitions
interface IdParams {
	id: string;
}

interface EventsQuery {
	limit?: number;
	type?: string;
}

interface LimitQuery {
	limit?: number;
}

interface UpdateBody {
	name?: string;
}

// Helper to get typed user from request
function getUser(request: FastifyRequest): AuthUser {
	return request.user as AuthUser;
}

export async function deviceRoutes(fastify: FastifyInstance) {
	// Require auth for all routes
	fastify.addHook("preHandler", fastify.authenticate);

	// Get all devices
	fastify.get("/", async (request) => {
		const user = getUser(request);
		const devices = deviceQueries.findByUserId.all(user.id);

		// Enrich with live status
		const enriched = await Promise.all(
			devices.map(async (device) => {
				let liveState = null;

				if (device.type === "roborock") {
					const states = await roborockService.getDevices(user.id);
					liveState = states.find((s) => s.id === device.device_id);
				} else if (device.type === "ring") {
					const states = await ringService.getDevices(user.id);
					liveState = states.find((s) => s.id === device.device_id);
				}

				return {
					...device,
					config: JSON.parse(device.config || "{}") as Record<string, unknown>,
					liveState,
				};
			}),
		);

		return { devices: enriched };
	});

	// Get device by ID
	fastify.get<{ Params: IdParams }>("/:id", async (request, reply) => {
		const user = getUser(request);
		const { id } = request.params;

		const device = deviceQueries.findById.get(id);
		if (!device || device.user_id !== user.id) {
			return reply.status(404).send({ error: "Device not found" });
		}

		let liveState = null;
		if (device.type === "roborock") {
			const states = await roborockService.getDevices(user.id);
			liveState = states.find((s) => s.id === device.device_id);
		} else if (device.type === "ring") {
			const states = await ringService.getDevices(user.id);
			liveState = states.find((s) => s.id === device.device_id);
		}

		return {
			...device,
			config: JSON.parse(device.config || "{}") as Record<string, unknown>,
			liveState,
		};
	});

	// Get device events
	fastify.get<{ Params: IdParams; Querystring: EventsQuery }>(
		"/:id/events",
		async (request, reply) => {
			const user = getUser(request);
			const { id } = request.params;
			const { limit = 50, type } = request.query;

			const device = deviceQueries.findById.get(id);
			if (!device || device.user_id !== user.id) {
				return reply.status(404).send({ error: "Device not found" });
			}

			let events: Event[];
			if (type) {
				events = eventQueries.findByType.all(id, type, Math.min(limit, 100));
			} else {
				events = eventQueries.findByDevice.all(id, Math.min(limit, 100));
			}

			return {
				events: events.map((e) => ({
					...e,
					data: JSON.parse(e.data || "{}") as Record<string, unknown>,
				})),
			};
		},
	);

	// Update device name
	fastify.patch<{ Params: IdParams; Body: UpdateBody }>(
		"/:id",
		async (request, reply) => {
			const user = getUser(request);
			const { id } = request.params;
			const { name } = request.body;

			const device = deviceQueries.findById.get(id);
			if (!device || device.user_id !== user.id) {
				return reply.status(404).send({ error: "Device not found" });
			}

			if (user.role !== "admin") {
				return reply.status(403).send({ error: "Admin access required" });
			}

			if (name) {
				// Would need to add update name query
			}

			return { success: true };
		},
	);

	// Delete device
	fastify.delete<{ Params: IdParams }>("/:id", async (request, reply) => {
		const user = getUser(request);
		const { id } = request.params;

		if (user.role !== "admin") {
			return reply.status(403).send({ error: "Admin access required" });
		}

		const device = deviceQueries.findById.get(id);
		if (!device || device.user_id !== user.id) {
			return reply.status(404).send({ error: "Device not found" });
		}

		deviceQueries.delete.run(id);
		return { success: true };
	});

	// Get recent events across all devices
	fastify.get<{ Querystring: LimitQuery }>(
		"/events/recent",
		async (request) => {
			const user = getUser(request);
			const { limit = 20 } = request.query;

			const events = eventQueries.findRecent.all(user.id, Math.min(limit, 100));

			return {
				events: events.map((e) => ({
					...e,
					data: JSON.parse(e.data || "{}") as Record<string, unknown>,
				})),
			};
		},
	);
}
