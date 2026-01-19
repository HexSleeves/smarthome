import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
		<div className="px-6 pb-4">
			<Alert variant="warning">
				<AlertTriangle className="h-4 w-4" />
				<AlertTitle>Recent Activity</AlertTitle>
				<AlertDescription>
					<div className="mt-2 space-y-1">
						{notifications.map((notif) => (
							<div
								key={`${notif.type}-${notif.time.getTime()}`}
								className="text-sm"
							>
								{notif.type === "ding"
									? "🔔 Doorbell pressed"
									: "🚶 Motion detected"}
								{" - "}
								{notif.time.toLocaleTimeString()}
							</div>
						))}
					</div>
				</AlertDescription>
			</Alert>
		</div>
	);
}
