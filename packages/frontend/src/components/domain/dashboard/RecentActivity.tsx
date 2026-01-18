import { Clock } from "lucide-react";
import { useRecentEvents } from "@/hooks";

export function RecentActivity() {
	const { events } = useRecentEvents(10);

	if (events.length === 0) {
		return null;
	}

	return (
		<div className="card p-6">
			<h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
			<div className="space-y-2">
				{events.map((event) => (
					<div
						key={event.id}
						className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
					>
						<Clock className="w-4 h-4 text-gray-400" />
						<span className="flex-1 text-sm">{event.type}</span>
						<span className="text-xs text-gray-500">
							{new Date(event.createdAt).toLocaleString()}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
