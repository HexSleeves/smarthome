import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { wsClient } from "@/lib/websocket";

type Notification = {
	type: string;
	time: Date;
	deviceId: string;
	deviceName?: string;
};

type DoorbellNotificationsProps = {
	deviceId: string;
};

export function DoorbellNotifications({
	deviceId,
}: DoorbellNotificationsProps) {
	const [notifications, setNotifications] = useState<Notification[]>([]);

	useEffect(() => {
		const unsubMotion = wsClient.on(
			"ring:motion",
			(data: Record<string, unknown>) => {
				if (data.deviceId === deviceId) {
					setNotifications((prev) =>
						[
							{
								type: "motion",
								time: new Date(),
								deviceId: data.deviceId as string,
								deviceName: data.deviceName as string,
							},
							...prev,
						].slice(0, 5),
					);
				}
			},
		);

		const unsubDing = wsClient.on(
			"ring:ding",
			(data: Record<string, unknown>) => {
				if (data.deviceId === deviceId) {
					setNotifications((prev) =>
						[
							{
								type: "ding",
								time: new Date(),
								deviceId: data.deviceId as string,
								deviceName: data.deviceName as string,
							},
							...prev,
						].slice(0, 5),
					);
				}
			},
		);

		return () => {
			unsubMotion();
			unsubDing();
		};
	}, [deviceId]);

	if (notifications.length === 0) {
		return null;
	}

	return (
		<div className="px-6 py-3 bg-yellow-50 dark:bg-yellow-900/30 border-b border-yellow-100 dark:border-yellow-900">
			<div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
				<AlertTriangle className="w-5 h-5" />
				<span className="font-medium">Recent Activity</span>
			</div>
			<div className="mt-2 space-y-1">
				{notifications.map((notif, i) => (
					<div key={i} className="text-sm text-yellow-600 dark:text-yellow-300">
						{notif.type === "ding"
							? "🔔 Doorbell pressed"
							: "🚶 Motion detected"}
						{" - "}
						{notif.time.toLocaleTimeString()}
					</div>
				))}
			</div>
		</div>
	);
}
