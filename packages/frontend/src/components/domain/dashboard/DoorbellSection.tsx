import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { DoorbellCard } from "@/components/domain/doorbell";
import { EmptyState } from "@/components/ui";
import { useDevicesByType, useRingStatus } from "@/hooks";

export function DoorbellSection() {
	const { connected, hasCredentials } = useRingStatus();
	const { devices: doorbells } = useDevicesByType("ring");

	return (
		<div className="card p-6">
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-lg font-semibold flex items-center gap-2">
					<Bell className="w-5 h-5 text-primary-600" />
					Ring Doorbell
				</h2>
				<Link
					to="/doorbell"
					className="text-sm text-primary-600 hover:text-primary-700"
				>
					View All →
				</Link>
			</div>

			{!connected && !hasCredentials ? (
				<EmptyState
					icon={Bell}
					title="No doorbell connected"
					actionLabel="Connect your Ring"
					actionLink="/settings"
				/>
			) : doorbells.length > 0 ? (
				<div className="space-y-3">
					{doorbells.map((doorbell) => (
						<DoorbellCard key={doorbell.id} doorbell={doorbell} />
					))}
				</div>
			) : (
				<div className="text-center py-8 text-gray-500">
					<p>Connecting to doorbell...</p>
				</div>
			)}
		</div>
	);
}
