import type {
	RoborockDevicesResponse,
	RoborockStatusResponse,
} from "@smarthome/shared";
import { z } from "zod";
import { hasCredentials } from "../../db/queries.js";
import { roborockService } from "../../services/roborock.js";
import { adminProcedure, protectedProcedure, router } from "../trpc.js";

const commandSchema = z.object({
	deviceId: z.string(),
	command: z.enum(["start", "pause", "stop", "home", "find"]),
});

export const roborockRouter = router({
	status: protectedProcedure.query(
		async ({ ctx }): Promise<RoborockStatusResponse> => ({
			connected: roborockService.isConnected(ctx.user.id),
			hasCredentials: hasCredentials(ctx.user.id, "roborock"),
		}),
	),

	devices: protectedProcedure.query(
		async ({ ctx }): Promise<RoborockDevicesResponse> => ({
			devices: await roborockService.getDevices(ctx.user.id),
		}),
	),

	auth: adminProcedure
		.input(z.object({ email: z.email(), password: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const result = await roborockService.authenticate(
				ctx.user.id,
				input.email,
				input.password,
			);
			if (!result.success) {
				if (result.twoFactorRequired) {
					return { success: false, twoFactorRequired: true };
				}
				throw new Error(result.error || "Authentication failed");
			}
			return { success: true };
		}),

	send2FACode: adminProcedure
		.input(z.object({ email: z.email() }))
		.mutation(async ({ ctx, input }) => {
			const result = await roborockService.send2FACode(
				ctx.user.id,
				input.email,
			);
			if (!result.success) {
				throw new Error(result.error || "Failed to send code");
			}
			return { success: true };
		}),

	verify2FACode: adminProcedure
		.input(z.object({ code: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const result = await roborockService.verify2FACode(
				ctx.user.id,
				input.code,
			);
			if (!result.success) {
				throw new Error(result.error || "Verification failed");
			}
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
		.input(commandSchema)
		.mutation(async ({ ctx, input }) => {
			const { deviceId, command } = input;
			const s = roborockService;
			const uid = ctx.user.id;

			const actions: Record<string, () => Promise<boolean>> = {
				start: () => s.startCleaning(uid, deviceId),
				pause: () => s.pauseCleaning(uid, deviceId),
				stop: () => s.stopCleaning(uid, deviceId),
				home: () => s.returnHome(uid, deviceId),
				find: () => s.findRobot(uid, deviceId),
			};

			const result = await actions[command]();
			if (!result) {
				throw new Error("Command failed - check server logs for details");
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
		.input(z.object({ deviceId: z.string(), roomIds: z.array(z.number()) }))
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
		.query(async ({ ctx, input }) => ({
			history: await roborockService.getCleanHistory(
				ctx.user.id,
				input.deviceId,
			),
		})),
});
