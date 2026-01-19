import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { DoorbellCard } from "@/components/domain/doorbell";
import { EmptyState } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDevicesByType, useRingStatus } from "@/hooks";

export function DoorbellSection() {
	const { connected, hasCredentials } = useRingStatus();
	const { devices: doorbells } = useDevicesByType("ring");

	const renderContent = () => {
		if (!connected && !hasCredentials) {
			return (
				<EmptyState
					icon={Bell}
					title="No doorbell connected"
					actionLabel="Connect your Ring"
					actionLink="/settings"
				/>
			);
		}

		if (doorbells.length > 0) {
			return (
				<div className="space-y-3">
					{doorbells.map((doorbell) => (
						<DoorbellCard key={doorbell.id} doorbell={doorbell} />
					))}
				</div>
			);
		}

		return (
			<div className="text-center py-8 text-muted-foreground">
				<p>Connecting to doorbell...</p>
			</div>
		);
	};

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
				<CardTitle className="flex items-center gap-2">
					<Bell className="w-5 h-5 text-primary" />
					Ring Doorbell
				</CardTitle>
				<Button variant="link" asChild className="px-0">
					<Link to="/doorbell">View All →</Link>
				</Button>
			</CardHeader>
			<CardContent>{renderContent()}</CardContent>
		</Card>
	);
}
