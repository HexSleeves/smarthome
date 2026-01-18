import type {
	Ring2FAResponse,
	RingAuthResponse,
	RingDevicesResponse,
	RingHistoryResponse,
	RingStatusResponse,
} from "@smarthome/shared";
import { z } from "zod";
import { hasCredentials } from "../../db/queries.js";
import { ringService } from "../../services/ring.js";
import { adminProcedure, protectedProcedure, router } from "../trpc.js";

export const ringRouter = router({
	status: protectedProcedure.query(
		async ({ ctx }): Promise<RingStatusResponse> => {
			return {
				connected: ringService.isConnected(ctx.user.id),
				hasCredentials: hasCredentials(ctx.user.id, "ring"),
				pending2FA: ringService.hasPending2FA(ctx.user.id),
			};
		},
	),

	devices: protectedProcedure.query(
		async ({ ctx }): Promise<RingDevicesResponse> => {
			const devices = await ringService.getDevices(ctx.user.id);
			return { devices };
		},
	),

	auth: adminProcedure
		.input(z.object({ email: z.email(), password: z.string() }))
		.mutation(async ({ ctx, input }): Promise<RingAuthResponse> => {
			const result = await ringService.authenticate(
				ctx.user.id,
				input.email,
				input.password,
			);
			return result;
		}),

	submit2FA: adminProcedure
		.input(z.object({ code: z.string() }))
		.mutation(async ({ ctx, input }): Promise<Ring2FAResponse> => {
			const result = await ringService.submitTwoFactorCode(
				ctx.user.id,
				input.code,
			);
			return result;
		}),

	cancel2FA: adminProcedure.mutation(async ({ ctx }) => {
		ringService.cancelPending2FA(ctx.user.id);
		return { success: true };
	}),

	connect: adminProcedure.mutation(async ({ ctx }) => {
		await ringService.connectWithStoredCredentials(ctx.user.id);
		return { success: true };
	}),

	disconnect: adminProcedure.mutation(async ({ ctx }) => {
		ringService.disconnect(ctx.user.id);
		return { success: true };
	}),

	history: protectedProcedure
		.input(z.object({ deviceId: z.string(), limit: z.number().default(20) }))
		.query(async ({ ctx, input }): Promise<RingHistoryResponse> => {
			const history = await ringService.getHistory(
				ctx.user.id,
				input.deviceId,
				input.limit,
			);
			return { history };
		}),

	toggleLight: adminProcedure
		.input(z.object({ deviceId: z.string(), on: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			await ringService.toggleLight(ctx.user.id, input.deviceId, input.on);
			return { success: true };
		}),

	triggerSiren: adminProcedure
		.input(z.object({ deviceId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await ringService.triggerSiren(ctx.user.id, input.deviceId);
			return { success: true };
		}),
});
