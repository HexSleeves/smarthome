import { useRealtimeEvents } from "@/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function LiveEvents() {
	const { events } = useRealtimeEvents(5);

	if (events.length === 0) {
		return null;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Live Events</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				{events.map((event) => {
					return (
						<div
							key={event.deviceId}
							className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
						>
							<Badge
								variant={
									event.type === "doorbell"
										? "warning"
										: event.type === "motion"
											? "info"
											: "success"
								}
								className="gap-1"
							>
								<span
									className={`w-2 h-2 rounded-full ${
										event.type === "doorbell"
											? "bg-yellow-500"
											: event.type === "motion"
												? "bg-blue-500"
												: "bg-green-500"
									}`}
								/>
							</Badge>
							<span className="flex-1 text-sm">
								{event.type === "doorbell"
									? "🔔 Doorbell pressed"
									: event.type === "motion"
										? "🚶 Motion detected"
										: `🧹 Vacuum: ${event.state?.status || "status update"}`}
							</span>
							<span className="text-xs text-muted-foreground">
								{event.timestamp.toLocaleTimeString()}
							</span>
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}
