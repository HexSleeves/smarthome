import type {
	RoborockDeviceState,
	RoborockFanSpeed,
	RoborockWaterLevel,
} from "@smarthome/shared";
import { useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { wsClient } from "@/lib/websocket";
import {
	useRoborockDeviceLastUpdated,
	useRoborockDevicesFromStore,
	useRoborockStore,
} from "@/stores/roborock";

export function useRoborockStatus() {
	const { data, isLoading, error } = trpc.roborock.status.useQuery();

	return {
		connected: data?.connected ?? false,
		hasCredentials: data?.hasCredentials ?? false,
		isLoading,
		error,
	};
}

/**
 * Hook for Roborock devices with real-time WebSocket updates.
 * Uses Zustand store to maintain device state that can be updated
 * both by tRPC queries and WebSocket events.
 */
export function useRoborockDevices() {
	const { connected } = useRoborockStatus();
	const setDevices = useRoborockStore((state) => state.setDevices);
	const updateDeviceFromWebSocket = useRoborockStore(
		(state) => state.updateDeviceFromWebSocket,
	);

	// Fetch devices via tRPC
	const { data, isLoading, error } = trpc.roborock.devices.useQuery(undefined, {
		enabled: connected,
		refetchInterval: 30000, // Poll every 30s as fallback
		staleTime: 10000, // Consider data stale after 10s
	});

	// Update store when tRPC data changes
	useEffect(() => {
		if (data?.devices) {
			setDevices(data.devices);
		}
	}, [data?.devices, setDevices]);

	// Subscribe to WebSocket updates
	useEffect(() => {
		if (!connected) return;

		const unsubscribe = wsClient.on(
			"roborock:status",
			(data: { deviceId: string; state: RoborockDeviceState }) => {
				if (data.deviceId && data.state) {
					updateDeviceFromWebSocket(data.deviceId, data.state);
				}
			},
		);

		return () => {
			unsubscribe();
		};
	}, [connected, updateDeviceFromWebSocket]);

	// Get devices from store (reactive)
	const devices = useRoborockDevicesFromStore();

	return {
		devices,
		isLoading,
		error,
	};
}

/**
 * Hook for a single Roborock device with real-time updates.
 */
export function useRoborockDevice(deviceId: string) {
	const device = useRoborockStore((state) => state.devicesById[deviceId]);
	const lastUpdated = useRoborockDeviceLastUpdated(deviceId);

	return {
		device,
		lastUpdated: lastUpdated ? new Date(lastUpdated) : undefined,
	};
}

export function useRoborockCommands(deviceId: string) {
	const utils = trpc.useUtils();
	const updateDevice = useRoborockStore((state) => state.updateDevice);

	const commandMutation = trpc.roborock.command.useMutation({
		onSuccess: (result) => {
			// Invalidate to fetch fresh data after command
			utils.roborock.devices.invalidate();

			if (!result.success && result.error) {
				// Could show a toast notification here
				console.warn("Command failed:", result.error, result.errorCategory);
			}
		},
	});

	const fanSpeedMutation = trpc.roborock.setFanSpeed.useMutation({
		onMutate: ({ speed }) => {
			// Optimistic update
			updateDevice(deviceId, { fanSpeed: speed });
		},
		onSuccess: (result) => {
			utils.roborock.devices.invalidate();
			if (!result.success && result.error) {
				console.warn("Set fan speed failed:", result.error);
			}
		},
		onError: () => {
			// Revert on error by refetching
			utils.roborock.devices.invalidate();
		},
	});

	const waterLevelMutation = trpc.roborock.setWaterLevel.useMutation({
		onMutate: ({ level }) => {
			// Optimistic update
			updateDevice(deviceId, { waterLevel: level });
		},
		onSuccess: (result) => {
			utils.roborock.devices.invalidate();
			if (!result.success && result.error) {
				console.warn("Set water level failed:", result.error);
			}
		},
		onError: () => {
			utils.roborock.devices.invalidate();
		},
	});

	return {
		sendCommand: (command: "start" | "pause" | "stop" | "home" | "find") =>
			commandMutation.mutate({ deviceId, command }),
		setFanSpeed: (speed: RoborockFanSpeed) =>
			fanSpeedMutation.mutate({ deviceId, speed }),
		setWaterLevel: (level: RoborockWaterLevel) =>
			waterLevelMutation.mutate({ deviceId, level }),
		isPending:
			commandMutation.isPending ||
			fanSpeedMutation.isPending ||
			waterLevelMutation.isPending,
		lastError: commandMutation.data?.error ?? null,
		lastErrorCategory: commandMutation.data?.errorCategory ?? null,
	};
}

export function useRoborockAuth() {
	const utils = trpc.useUtils();

	const authMutation = trpc.roborock.auth.useMutation({
		onSuccess: (data) => {
			if (data.success) {
				utils.roborock.status.invalidate();
				utils.roborock.devices.invalidate();
			}
		},
	});

	const send2FACodeMutation = trpc.roborock.send2FACode.useMutation();

	const verify2FACodeMutation = trpc.roborock.verify2FACode.useMutation({
		onSuccess: () => {
			utils.roborock.status.invalidate();
			utils.roborock.devices.invalidate();
		},
	});

	const connectMutation = trpc.roborock.connect.useMutation({
		onSuccess: () => {
			utils.roborock.status.invalidate();
			utils.roborock.devices.invalidate();
		},
	});

	const disconnectMutation = trpc.roborock.disconnect.useMutation({
		onSuccess: () => {
			utils.roborock.status.invalidate();
		},
	});

	return {
		authenticate: (email: string, password: string) =>
			authMutation.mutateAsync({ email, password }),
		send2FACode: (email: string) => send2FACodeMutation.mutateAsync({ email }),
		verify2FACode: (code: string) =>
			verify2FACodeMutation.mutateAsync({ code }),
		connect: () => connectMutation.mutateAsync(),
		disconnect: () => disconnectMutation.mutateAsync(),
		isAuthenticating: authMutation.isPending,
		isSending2FACode: send2FACodeMutation.isPending,
		isVerifying2FACode: verify2FACodeMutation.isPending,
		isConnecting: connectMutation.isPending,
		isDisconnecting: disconnectMutation.isPending,
		authError: authMutation.error,
		connectError: connectMutation.error,
	};
}
