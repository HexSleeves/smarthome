import { Clock } from "lucide-react";
import { useRingHistory } from "@/hooks";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type DoorbellHistoryProps = {
	deviceId: string;
};

export function DoorbellHistory({ deviceId }: DoorbellHistoryProps) {
	const { history, isLoading } = useRingHistory(deviceId);

	if (isLoading || history.length === 0) {
		return null;
	}

	return (
		<div className="space-y-3">
			<Label className="text-muted-foreground flex items-center gap-2">
				<Clock className="w-4 h-4" />
				Recent Events
			</Label>
			<div className="space-y-2">
				{history.map((event, i) => (
					<div
						key={event.ding_id_str || i}
						className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
					>
						<span
							className={cn(
								"w-2 h-2 rounded-full",
								event.kind === "ding" ? "bg-yellow-500" : "bg-blue-500",
							)}
						/>
						<div className="flex-1">
							<Badge variant={event.kind === "ding" ? "warning" : "info"}>
								{event.kind === "ding"
									? "Doorbell Press"
									: event.kind || "Motion"}
							</Badge>
							<p className="text-xs text-muted-foreground mt-1">
								{event.created_at
									? new Date(event.created_at).toLocaleString()
									: "Unknown time"}
							</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
