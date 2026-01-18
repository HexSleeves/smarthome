import { trpc } from "@/lib/trpc/client";

export function useRingStatus() {
	const { data, isLoading, error } = trpc.ring.status.useQuery();

	return {
		connected: data?.connected ?? false,
		hasCredentials: data?.hasCredentials ?? false,
		pending2FA: data?.pending2FA ?? false,
		isLoading,
		error,
	};
}

export function useRingDevices() {
	const { connected } = useRingStatus();
	const { data, isLoading, error } = trpc.ring.devices.useQuery(undefined, {
		enabled: connected,
		refetchInterval: 30000,
	});

	return {
		devices: data?.devices ?? [],
		isLoading,
		error,
	};
}

export function useRingHistory(deviceId: string, limit = 20) {
	const { data, isLoading, error } = trpc.ring.history.useQuery(
		{ deviceId, limit },
		{ enabled: !!deviceId },
	);

	return {
		history: data?.history ?? [],
		isLoading,
		error,
	};
}

export function useRingControls(deviceId: string) {
	const lightMutation = trpc.ring.toggleLight.useMutation();
	const sirenMutation = trpc.ring.triggerSiren.useMutation();

	return {
		toggleLight: (on: boolean) => lightMutation.mutate({ deviceId, on }),
		triggerSiren: () => sirenMutation.mutate({ deviceId }),
		isPending: lightMutation.isPending || sirenMutation.isPending,
	};
}

export function useRingAuth() {
	const utils = trpc.useUtils();

	const authMutation = trpc.ring.auth.useMutation({
		onSuccess: (data) => {
			if (!data.requiresTwoFactor) {
				utils.ring.status.invalidate();
				utils.ring.devices.invalidate();
			}
		},
	});

	const submit2FAMutation = trpc.ring.submit2FA.useMutation({
		onSuccess: () => {
			utils.ring.status.invalidate();
			utils.ring.devices.invalidate();
		},
	});

	const cancel2FAMutation = trpc.ring.cancel2FA.useMutation({
		onSuccess: () => {
			utils.ring.status.invalidate();
		},
	});

	const connectMutation = trpc.ring.connect.useMutation({
		onSuccess: () => {
			utils.ring.status.invalidate();
			utils.ring.devices.invalidate();
		},
	});

	const disconnectMutation = trpc.ring.disconnect.useMutation({
		onSuccess: () => {
			utils.ring.status.invalidate();
		},
	});

	return {
		authenticate: (email: string, password: string) =>
			authMutation.mutateAsync({ email, password }),
		submit2FA: (code: string) => submit2FAMutation.mutateAsync({ code }),
		cancel2FA: () => cancel2FAMutation.mutateAsync(),
		connect: () => connectMutation.mutateAsync(),
		disconnect: () => disconnectMutation.mutateAsync(),
		isAuthenticating: authMutation.isPending,
		isSubmitting2FA: submit2FAMutation.isPending,
		isCancelling2FA: cancel2FAMutation.isPending,
		isConnecting: connectMutation.isPending,
		isDisconnecting: disconnectMutation.isPending,
		authError: authMutation.error,
		twoFactorError: submit2FAMutation.error,
		connectError: connectMutation.error,
	};
}
