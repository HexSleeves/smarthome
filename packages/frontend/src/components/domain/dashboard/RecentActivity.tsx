import { Clock } from "lucide-react";
import { useRecentEvents } from "@/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RecentActivity() {
	const { events } = useRecentEvents(10);

	if (events.length === 0) {
		return null;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Recent Activity</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				{events.map((event) => (
					<div
						key={event.id}
						className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
					>
						<Clock className="w-4 h-4 text-muted-foreground" />
						<span className="flex-1 text-sm">{event.type}</span>
						<span className="text-xs text-muted-foreground">
							{new Date(event.createdAt).toLocaleString()}
						</span>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
