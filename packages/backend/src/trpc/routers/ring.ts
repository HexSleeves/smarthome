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
		async ({ ctx }): Promise<RingStatusResponse> => ({
			connected: ringService.isConnected(ctx.user.id),
			hasCredentials: hasCredentials(ctx.user.id, "ring"),
			pending2FA: ringService.hasPending2FA(ctx.user.id),
		}),
	),

	devices: protectedProcedure.query(
		async ({ ctx }): Promise<RingDevicesResponse> => ({
			devices: await ringService.getDevices(ctx.user.id),
		}),
	),

	auth: adminProcedure
		.input(z.object({ email: z.email(), password: z.string() }))
		.mutation(
			async ({ ctx, input }): Promise<RingAuthResponse> =>
				ringService.authenticate(ctx.user.id, input.email, input.password),
		),

	submit2FA: adminProcedure
		.input(z.object({ code: z.string() }))
		.mutation(
			async ({ ctx, input }): Promise<Ring2FAResponse> =>
				ringService.submitTwoFactorCode(ctx.user.id, input.code),
		),

	cancel2FA: adminProcedure.mutation(async ({ ctx }) => {
		ringService.cancelPending2FA(ctx.user.id);
		return { success: true };
	}),

	connect: adminProcedure.mutation(async ({ ctx }) => {
		const success = await ringService.connectWithStoredCredentials(ctx.user.id);
		return {
			success,
			error: success ? undefined : "Failed to connect with stored credentials",
		};
	}),

	disconnect: adminProcedure.mutation(async ({ ctx }) => {
		ringService.disconnect(ctx.user.id);
		return { success: true };
	}),

	history: protectedProcedure
		.input(z.object({ deviceId: z.string(), limit: z.number().default(20) }))
		.query(
			async ({ ctx, input }): Promise<RingHistoryResponse> => ({
				history: await ringService.getHistory(
					ctx.user.id,
					input.deviceId,
					input.limit,
				),
			}),
		),

	toggleLight: adminProcedure
		.input(z.object({ deviceId: z.string(), on: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			const success = await ringService.toggleLight(
				ctx.user.id,
				input.deviceId,
				input.on,
			);
			return {
				success,
				error: success
					? undefined
					: "Device does not have a light or not found",
			};
		}),

	triggerSiren: adminProcedure
		.input(z.object({ deviceId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const success = await ringService.triggerSiren(
				ctx.user.id,
				input.deviceId,
			);
			return {
				success,
				error: success
					? undefined
					: "Device does not have a siren or not found",
			};
		}),

	// HLS streaming endpoints
	startStream: protectedProcedure
		.input(
			z.object({
				deviceId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const result = await ringService.startHlsStream(
				ctx.user.id,
				input.deviceId,
			);
			if (!result) {
				return { success: false, error: "Failed to start stream" };
			}
			return {
				success: true,
				sessionId: result.sessionId,
				streamUrl: result.streamUrl,
			};
		}),

	stopStream: protectedProcedure
		.input(
			z.object({
				deviceId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const success = await ringService.stopHlsStream(
				ctx.user.id,
				input.deviceId,
			);
			return { success };
		}),

	streamStatus: protectedProcedure
		.input(
			z.object({
				deviceId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const isActive = ringService.isStreamActive(ctx.user.id, input.deviceId);
			return { isActive };
		}),
});
