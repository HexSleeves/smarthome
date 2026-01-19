import { Wifi } from "lucide-react";
import { Link } from "react-router-dom";
import { VacuumCard } from "@/components/domain/vacuum";
import {
	DeviceCardSkeleton,
	DeviceSectionSkeleton,
	EmptyState,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDevicesByType, useRoborockStatus } from "@/hooks";

export function VacuumSection() {
	const {
		connected,
		hasCredentials,
		isLoading: statusLoading,
	} = useRoborockStatus();
	const { devices: vacuums, isLoading: devicesLoading } =
		useDevicesByType("roborock");

	// Show skeleton while loading initial status
	if (statusLoading) {
		return <DeviceSectionSkeleton />;
	}

	const renderContent = () => {
		if (!connected && !hasCredentials) {
			return (
				<EmptyState
					icon={Wifi}
					title="No vacuum connected"
					actionLabel="Connect your Roborock"
					actionLink="/settings"
				/>
			);
		}

		// Show skeleton while loading devices
		if (devicesLoading) {
			return (
				<div className="space-y-3">
					<DeviceCardSkeleton />
				</div>
			);
		}

		if (vacuums.length > 0) {
			return (
				<div className="space-y-3">
					{vacuums.map((vacuum) => (
						<VacuumCard key={vacuum.id} vacuum={vacuum} />
					))}
				</div>
			);
		}

		return (
			<div className="text-center py-8 text-muted-foreground">
				<p>Connecting to vacuum...</p>
			</div>
		);
	};

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
				<CardTitle className="flex items-center gap-2">
					<Wifi className="w-5 h-5 text-primary" />
					Robot Vacuum
				</CardTitle>
				<Button variant="link" asChild className="px-0">
					<Link to="/vacuum">View All →</Link>
				</Button>
			</CardHeader>
			<CardContent>{renderContent()}</CardContent>
		</Card>
	);
}
