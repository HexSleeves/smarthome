import { Battery } from "lucide-react";
import type { Device, RoborockDeviceState } from "@smarthome/shared";

const statusColors: Record<string, string> = {
	idle: "bg-gray-500",
	cleaning: "bg-green-500",
	returning: "bg-blue-500",
	charging: "bg-yellow-500",
	paused: "bg-orange-500",
	error: "bg-red-500",
	offline: "bg-gray-400",
};

type VacuumCardProps = {
	vacuum: Device;
};

export function VacuumCard({ vacuum }: VacuumCardProps) {
	const state = vacuum.liveState as RoborockDeviceState | undefined;

	return (
		<div className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
			<div
				className={`w-3 h-3 rounded-full ${statusColors[state?.status || "offline"]}`}
			/>
			<div className="flex-1">
				<p className="font-medium">{vacuum.name}</p>
				<p className="text-sm text-gray-500 capitalize">
					{state?.status || "Offline"}
				</p>
			</div>
			{state?.battery !== undefined && (
				<div className="flex items-center gap-1 text-sm">
					<Battery className="w-4 h-4" />
					{state.battery}%
				</div>
			)}
		</div>
	);
}
