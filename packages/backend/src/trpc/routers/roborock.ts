import type {
	RoborockDevicesResponse,
	RoborockStatusResponse,
} from "@smarthome/shared";
import { z } from "zod";
import { hasCredentials } from "../../db/queries.js";
import { roborockService } from "../../services/roborock.js";
import { adminProcedure, protectedProcedure, router } from "../trpc.js";

export const roborockRouter = router({
	status: protectedProcedure.query(
		async ({ ctx }): Promise<RoborockStatusResponse> => {
			return {
				connected: roborockService.isConnected(ctx.user.id),
				hasCredentials: hasCredentials(ctx.user.id, "roborock"),
			};
		},
	),

	devices: protectedProcedure.query(
		async ({ ctx }): Promise<RoborockDevicesResponse> => {
			const devices = await roborockService.getDevices(ctx.user.id);
			return { devices };
		},
	),

	auth: adminProcedure
		.input(z.object({ email: z.email(), password: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await roborockService.authenticate(
				ctx.user.id,
				input.email,
				input.password,
			);
			return { success: true };
		}),

	connect: adminProcedure.mutation(async ({ ctx }) => {
		await roborockService.connectWithStoredCredentials(ctx.user.id);
		return { success: true };
	}),

	disconnect: adminProcedure.mutation(async ({ ctx }) => {
		roborockService.disconnect(ctx.user.id);
		return { success: true };
	}),

	command: adminProcedure
		.input(
			z.object({
				deviceId: z.string(),
				command: z.enum(["start", "pause", "stop", "home", "find"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { deviceId, command } = input;
			const userId = ctx.user.id;

			switch (command) {
				case "start":
					await roborockService.startCleaning(userId, deviceId);
					break;
				case "pause":
					await roborockService.pauseCleaning(userId, deviceId);
					break;
				case "stop":
					await roborockService.stopCleaning(userId, deviceId);
					break;
				case "home":
					await roborockService.returnHome(userId, deviceId);
					break;
				case "find":
					await roborockService.findRobot(userId, deviceId);
					break;
			}
			return { success: true };
		}),

	setFanSpeed: adminProcedure
		.input(
			z.object({
				deviceId: z.string(),
				speed: z.enum(["quiet", "balanced", "turbo", "max"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await roborockService.setFanSpeed(
				ctx.user.id,
				input.deviceId,
				input.speed,
			);
			return { success: true };
		}),

	setWaterLevel: adminProcedure
		.input(
			z.object({
				deviceId: z.string(),
				level: z.enum(["off", "low", "medium", "high"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await roborockService.setWaterLevel(
				ctx.user.id,
				input.deviceId,
				input.level,
			);
			return { success: true };
		}),

	cleanRooms: adminProcedure
		.input(
			z.object({
				deviceId: z.string(),
				roomIds: z.array(z.number()),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await roborockService.cleanRooms(
				ctx.user.id,
				input.deviceId,
				input.roomIds,
			);
			return { success: true };
		}),

	history: protectedProcedure
		.input(z.object({ deviceId: z.string() }))
		.query(async ({ ctx, input }) => {
			const history = await roborockService.getCleanHistory(
				ctx.user.id,
				input.deviceId,
			);
			return { history };
		}),
});
