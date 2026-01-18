import { Activity, Bell, Clock, Wifi } from "lucide-react";
import { StatCard } from "@/components/ui";
import {
	useDevices,
	useRecentEvents,
	useRingStatus,
	useRoborockStatus,
} from "@/hooks";

export function DashboardStats() {
	const { devices } = useDevices();
	const { events } = useRecentEvents(10);
	const { connected: roborockConnected } = useRoborockStatus();
	const { connected: ringConnected } = useRingStatus();

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			<StatCard
				title="Vacuum"
				icon={Wifi}
				value={roborockConnected ? "Connected" : "Disconnected"}
				status={roborockConnected ? "success" : "warning"}
				link="/vacuum"
			/>
			<StatCard
				title="Doorbell"
				icon={Bell}
				value={ringConnected ? "Connected" : "Disconnected"}
				status={ringConnected ? "success" : "warning"}
				link="/doorbell"
			/>
			<StatCard
				title="Total Devices"
				icon={Activity}
				value={String(devices.length)}
				status="neutral"
			/>
			<StatCard
				title="Recent Events"
				icon={Clock}
				value={String(events.length)}
				status="neutral"
			/>
		</div>
	);
}
