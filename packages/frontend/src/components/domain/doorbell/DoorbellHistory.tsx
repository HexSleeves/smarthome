import { Clock } from "lucide-react";
import { useRingHistory } from "@/hooks";

type DoorbellHistoryProps = {
	deviceId: string;
};

export function DoorbellHistory({ deviceId }: DoorbellHistoryProps) {
	const { history, isLoading } = useRingHistory(deviceId);

	if (isLoading || history.length === 0) {
		return null;
	}

	return (
		<div>
			<h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
				<Clock className="w-4 h-4" />
				Recent Events
			</h3>
			<div className="space-y-2">
				{history.map((event, i) => (
					<div
						key={event.ding_id_str || i}
						className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
					>
						<div
							className={`w-2 h-2 rounded-full ${
								event.kind === "ding" ? "bg-yellow-500" : "bg-blue-500"
							}`}
						/>
						<div className="flex-1">
							<p className="text-sm font-medium capitalize">
								{event.kind === "ding"
									? "Doorbell Press"
									: event.kind || "Motion"}
							</p>
							<p className="text-xs text-gray-500">
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
