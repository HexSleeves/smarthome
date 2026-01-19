import { Bell } from "lucide-react";
import { DoorbellDevice } from "@/components/domain/doorbell";
import { DoorbellDeviceSkeleton, EmptyState } from "@/components/ui";
import { useRingDevices, useRingStatus } from "@/hooks";
import { useAuthStore } from "@/stores/auth";

export function DoorbellPage() {
	const { user } = useAuthStore();
	const isAdmin = user?.role === "admin";

	const {
		connected,
		hasCredentials,
		isLoading: statusLoading,
	} = useRingStatus();
	const { devices, isLoading: devicesLoading } = useRingDevices();

	// Show skeleton while loading
	if (statusLoading || devicesLoading) {
		return (
			<div className="space-y-6">
				<DoorbellDeviceSkeleton />
			</div>
		);
	}

	if (!connected && !hasCredentials) {
		return (
			<EmptyState
				icon={Bell}
				title="No Doorbell Connected"
				description="Connect your Ring doorbell in Settings to get started."
				actionLabel="Go to Settings"
				actionLink="/settings"
			/>
		);
	}

	if (devices.length === 0) {
		return (
			<EmptyState
				icon={Bell}
				title="No Devices Found"
				description="Make sure your Ring device is set up in the Ring app."
			/>
		);
	}

	return (
		<div className="space-y-6">
			{devices.map((device) => (
				<DoorbellDevice key={device.id} device={device} isAdmin={isAdmin} />
			))}
		</div>
	);
}
