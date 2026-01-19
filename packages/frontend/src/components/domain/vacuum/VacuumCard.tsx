import { Battery } from "lucide-react";
import type { Device, RoborockDeviceState } from "@smarthome/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<
	string,
	{
		variant: "success" | "warning" | "destructive" | "secondary" | "info";
		dot: string;
	}
> = {
	idle: { variant: "secondary", dot: "bg-gray-500" },
	cleaning: { variant: "success", dot: "bg-green-500" },
	returning: { variant: "info", dot: "bg-blue-500" },
	charging: { variant: "warning", dot: "bg-yellow-500" },
	paused: { variant: "warning", dot: "bg-orange-500" },
	error: { variant: "destructive", dot: "bg-red-500" },
	offline: { variant: "secondary", dot: "bg-gray-400" },
};

type VacuumCardProps = {
	vacuum: Device;
};

export function VacuumCard({ vacuum }: VacuumCardProps) {
	const state = vacuum.liveState as RoborockDeviceState | undefined;
	const config = statusConfig[state?.status || "offline"];

	return (
		<div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
			<span className={cn("w-3 h-3 rounded-full", config.dot)} />
			<div className="flex-1">
				<p className="font-medium">{vacuum.name}</p>
				<Badge variant={config.variant} className="mt-1">
					{state?.status || "Offline"}
				</Badge>
			</div>
			{state?.battery !== undefined && (
				<div className="flex items-center gap-1 text-sm text-muted-foreground">
					<Battery className="w-4 h-4" />
					{state.battery}%
				</div>
			)}
		</div>
	);
}
