import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../../db/schema.js";
import type { Device, DeviceEvent } from "@smarthome/shared";

// Get live state from services
import { getRoborockLiveState } from "../../services/roborock.js";
import { getRingLiveState } from "../../services/ring.js";

export const deviceRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		const rows = db
			.prepare(
				`SELECT id, user_id, type, name, device_id, config, status, last_seen, created_at, updated_at 
         FROM devices WHERE user_id = ?`,
			)
			.all(ctx.user.id) as any[];

		const devices: Device[] = rows.map((row) => {
			const device: Device = {
				id: row.id,
				userId: row.user_id,
				type: row.type,
				name: row.name,
				deviceId: row.device_id,
				config: JSON.parse(row.config || "{}"),
				status: row.status,
				lastSeen: row.last_seen,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			};

			// Attach live state
			if (device.type === "roborock" && device.deviceId) {
				device.liveState = getRoborockLiveState(device.deviceId);
			} else if (device.type === "ring" && device.deviceId) {
				device.liveState = getRingLiveState(device.deviceId);
			}

			return device;
		});

		return { devices };
	}),

	get: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const row = db
				.prepare(
					`SELECT id, user_id, type, name, device_id, config, status, last_seen, created_at, updated_at 
           FROM devices WHERE id = ? AND user_id = ?`,
				)
				.get(input.id, ctx.user.id) as any;

			if (!row) {
				return null;
			}

			const device: Device = {
				id: row.id,
				userId: row.user_id,
				type: row.type,
				name: row.name,
				deviceId: row.device_id,
				config: JSON.parse(row.config || "{}"),
				status: row.status,
				lastSeen: row.last_seen,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			};

			return device;
		}),

	events: protectedProcedure
		.input(z.object({ deviceId: z.string(), limit: z.number().default(50) }))
		.query(async ({ ctx, input }) => {
			// Verify device belongs to user
			const device = db
				.prepare("SELECT id FROM devices WHERE id = ? AND user_id = ?")
				.get(input.deviceId, ctx.user.id);

			if (!device) {
				return { events: [] };
			}

			const rows = db
				.prepare(
					`SELECT id, device_id, type, data, created_at 
           FROM events WHERE device_id = ? 
           ORDER BY created_at DESC LIMIT ?`,
				)
				.all(input.deviceId, input.limit) as any[];

			const events: DeviceEvent[] = rows.map((row) => ({
				id: row.id,
				deviceId: row.device_id,
				type: row.type,
				data: JSON.parse(row.data || "{}"),
				createdAt: row.created_at,
			}));

			return { events };
		}),

	recentEvents: protectedProcedure
		.input(z.object({ limit: z.number().default(20) }))
		.query(async ({ ctx, input }) => {
			const rows = db
				.prepare(
					`SELECT e.id, e.device_id, e.type, e.data, e.created_at 
           FROM events e
           JOIN devices d ON e.device_id = d.id
           WHERE d.user_id = ?
           ORDER BY e.created_at DESC LIMIT ?`,
				)
				.all(ctx.user.id, input.limit) as any[];

			const events: DeviceEvent[] = rows.map((row) => ({
				id: row.id,
				deviceId: row.device_id,
				type: row.type,
				data: JSON.parse(row.data || "{}"),
				createdAt: row.created_at,
			}));

			return { events };
		}),
});
