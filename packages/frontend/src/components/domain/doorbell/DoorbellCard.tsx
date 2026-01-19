import type { Device, RingDeviceState } from "@smarthome/shared";
import { Battery } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type DoorbellCardProps = {
	doorbell: Device;
};

export function DoorbellCard({ doorbell }: DoorbellCardProps) {
	const state = doorbell.liveState as RingDeviceState | undefined;
	const isOnline = state?.status === "online";

	return (
		<div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
			<span className={cn("w-3 h-3 rounded-full", isOnline ? "bg-green-500" : "bg-gray-400")} />
			<div className="flex-1">
				<p className="font-medium">{doorbell.name}</p>
				<Badge variant={isOnline ? "success" : "secondary"} className="mt-1">
					{state?.type || "Doorbell"}
				</Badge>
			</div>
			{state?.battery !== undefined && state?.battery !== null && (
				<div className="flex items-center gap-1 text-sm text-muted-foreground">
					<Battery className="w-4 h-4" />
					{state.battery}%
				</div>
			)}
		</div>
	);
}
