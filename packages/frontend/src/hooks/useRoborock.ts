import type { RoborockFanSpeed, RoborockWaterLevel } from "@smarthome/shared";
import { trpc } from "@/lib/trpc/client";

export function useRoborockStatus() {
	const { data, isLoading, error } = trpc.roborock.status.useQuery();

	return {
		connected: data?.connected ?? false,
		hasCredentials: data?.hasCredentials ?? false,
		isLoading,
		error,
	};
}

export function useRoborockDevices() {
	const { connected } = useRoborockStatus();
	const { data, isLoading, error } = trpc.roborock.devices.useQuery(undefined, {
		enabled: connected,
		refetchInterval: 10000,
	});

	return {
		devices: data?.devices ?? [],
		isLoading,
		error,
	};
}

export function useRoborockCommands(deviceId: string) {
	const utils = trpc.useUtils();

	const commandMutation = trpc.roborock.command.useMutation({
		onSuccess: () => {
			utils.roborock.devices.invalidate();
		},
	});

	const fanSpeedMutation = trpc.roborock.setFanSpeed.useMutation({
		onSuccess: () => {
			utils.roborock.devices.invalidate();
		},
	});

	const waterLevelMutation = trpc.roborock.setWaterLevel.useMutation({
		onSuccess: () => {
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
	};
}

export function useRoborockAuth() {
	const utils = trpc.useUtils();

	const authMutation = trpc.roborock.auth.useMutation({
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
		connect: () => connectMutation.mutateAsync(),
		disconnect: () => disconnectMutation.mutateAsync(),
		isAuthenticating: authMutation.isPending,
		isConnecting: connectMutation.isPending,
		isDisconnecting: disconnectMutation.isPending,
		authError: authMutation.error,
		connectError: connectMutation.error,
	};
}
