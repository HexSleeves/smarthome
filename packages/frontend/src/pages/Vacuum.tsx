import { Wind } from "lucide-react";
import { VacuumDevice } from "@/components/domain/vacuum";
import { EmptyState, VacuumDeviceSkeleton } from "@/components/ui";
import { useRoborockDevices, useRoborockStatus } from "@/hooks";
import { useAuthStore } from "@/stores/auth";

export function VacuumPage() {
	const { user } = useAuthStore();
	const isAdmin = user?.role === "admin";

	const {
		connected,
		hasCredentials,
		isLoading: statusLoading,
	} = useRoborockStatus();
	const { devices, isLoading: devicesLoading } = useRoborockDevices();

	// Show skeleton while loading
	if (statusLoading || devicesLoading) {
		return (
			<div className="space-y-6">
				<VacuumDeviceSkeleton />
			</div>
		);
	}

	if (!connected && !hasCredentials) {
		return (
			<EmptyState
				icon={Wind}
				title="No Vacuum Connected"
				description="Connect your Roborock vacuum in Settings to get started."
				actionLabel="Go to Settings"
				actionLink="/settings"
			/>
		);
	}

	if (devices.length === 0) {
		return (
			<EmptyState
				icon={Wind}
				title="No Devices Found"
				description="Make sure your vacuum is set up in the Roborock app."
			/>
		);
	}

	return (
		<div className="space-y-6">
			{devices.map((device) => (
				<VacuumDevice key={device.id} device={device} isAdmin={isAdmin} />
			))}
		</div>
	);
}
