import { ConnectionStatus } from "@/components/ui";
import {
	DashboardStats,
	VacuumSection,
	DoorbellSection,
	LiveEvents,
	RecentActivity,
} from "@/components/domain/dashboard";
import { useWebSocketConnection } from "@/hooks";

export function DashboardPage() {
	const { connected } = useWebSocketConnection();

	return (
		<div className="space-y-6">
			{/* Status Bar */}
			<div className="flex items-center gap-4 text-sm">
				<ConnectionStatus connected={connected} />
			</div>

			{/* Quick Stats */}
			<DashboardStats />

			{/* Device Cards */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<VacuumSection />
				<DoorbellSection />
			</div>

			{/* Events */}
			<LiveEvents />
			<RecentActivity />
		</div>
	);
}
