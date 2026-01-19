import { Wifi } from "lucide-react";
import { Link } from "react-router-dom";
import { VacuumCard } from "@/components/domain/vacuum";
import { EmptyState } from "@/components/ui";
import { useDevicesByType, useRoborockStatus } from "@/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function VacuumSection() {
	const { connected, hasCredentials } = useRoborockStatus();
	const { devices: vacuums } = useDevicesByType("roborock");

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
			<CardContent>
				{!connected && !hasCredentials ? (
					<EmptyState
						icon={Wifi}
						title="No vacuum connected"
						actionLabel="Connect your Roborock"
						actionLink="/settings"
					/>
				) : vacuums.length > 0 ? (
					<div className="space-y-3">
						{vacuums.map((vacuum) => (
							<VacuumCard key={vacuum.id} vacuum={vacuum} />
						))}
					</div>
				) : (
					<div className="text-center py-8 text-muted-foreground">
						<p>Connecting to vacuum...</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
