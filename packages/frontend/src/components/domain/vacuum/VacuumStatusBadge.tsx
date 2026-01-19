import type { RoborockStatus } from "@smarthome/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<
	RoborockStatus,
	{
		variant: "success" | "warning" | "destructive" | "info" | "secondary";
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

const statusText: Record<RoborockStatus, string> = {
	idle: "Idle",
	cleaning: "Cleaning",
	returning: "Returning to dock",
	charging: "Charging",
	paused: "Paused",
	error: "Error",
	offline: "Offline",
};

type VacuumStatusBadgeProps = {
	status: RoborockStatus;
};

export function VacuumStatusBadge({ status }: VacuumStatusBadgeProps) {
	const config = statusConfig[status];
	return (
		<Badge variant={config.variant} className="gap-1.5">
			<span className={cn("w-2 h-2 rounded-full", config.dot)} />
			{statusText[status]}
		</Badge>
	);
}
