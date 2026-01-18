import { Wind } from "lucide-react";
import { useRoborockStatus, useRoborockDevices } from "@/hooks";
import { useAuthStore } from "@/stores/auth";
import { EmptyState, PageSpinner } from "@/components/ui";
import { VacuumDevice } from "@/components/domain/vacuum";

export function VacuumPage() {
	const { user } = useAuthStore();
	const isAdmin = user?.role === "admin";

	const { connected, hasCredentials } = useRoborockStatus();
	const { devices, isLoading } = useRoborockDevices();

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

	if (isLoading) {
		return <PageSpinner />;
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
