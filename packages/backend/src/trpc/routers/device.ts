import type { Device, DeviceEvent } from "@smarthome/shared";
import { z } from "zod";
import { db } from "../../db/schema.js";
import { getRingLiveState } from "../../services/ring.js";
import { getRoborockLiveState } from "../../services/roborock.js";
import type { DbDeviceRow, DbEventRow } from "../../types.js";
import { protectedProcedure, router } from "../trpc.js";

const mapDevice = (row: DbDeviceRow): Device => ({
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
});

const mapEvent = (row: DbEventRow): DeviceEvent => ({
	id: row.id,
	deviceId: row.device_id,
	type: row.type,
	data: JSON.parse(row.data || "{}"),
	createdAt: row.created_at,
});

// Prepared queries for bun:sqlite with positional parameters
const listDevicesQuery = db.query<DbDeviceRow, [string]>(
	"SELECT * FROM devices WHERE user_id = ?",
);

const getDeviceQuery = db.query<DbDeviceRow, [string, string]>(
	"SELECT * FROM devices WHERE id = ? AND user_id = ?",
);

const checkDeviceOwnerQuery = db.query<{ id: string }, [string, string]>(
	"SELECT id FROM devices WHERE id = ? AND user_id = ?",
);

const getDeviceEventsQuery = db.query<DbEventRow, [string, number]>(
	"SELECT * FROM events WHERE device_id = ? ORDER BY created_at DESC LIMIT ?",
);

const getRecentEventsQuery = db.query<DbEventRow, [string, number]>(
	`SELECT e.* FROM events e
	 JOIN devices d ON e.device_id = d.id
	 WHERE d.user_id = ?
	 ORDER BY e.created_at DESC LIMIT ?`,
);

export const deviceRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		const rows = listDevicesQuery.all(ctx.user.id);

		const devices = rows.map((row) => {
			const device = mapDevice(row);
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
			const row = getDeviceQuery.get(input.id, ctx.user.id);
			return row ? mapDevice(row) : null;
		}),

	events: protectedProcedure
		.input(z.object({ deviceId: z.string(), limit: z.number().default(50) }))
		.query(async ({ ctx, input }) => {
			const device = checkDeviceOwnerQuery.get(input.deviceId, ctx.user.id);

			if (!device) return { events: [] };

			const rows = getDeviceEventsQuery.all(input.deviceId, input.limit);

			return { events: rows.map(mapEvent) };
		}),

	recentEvents: protectedProcedure
		.input(z.object({ limit: z.number().default(20) }))
		.query(async ({ ctx, input }) => {
			const rows = getRecentEventsQuery.all(ctx.user.id, input.limit);

			return { events: rows.map(mapEvent) };
		}),
});
