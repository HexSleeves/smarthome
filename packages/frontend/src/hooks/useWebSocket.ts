import type { RealtimeEvent, RoborockDeviceState } from "@smarthome/shared";
import { useCallback, useEffect, useState } from "react";
import { wsClient } from "@/lib/websocket";

export function useWebSocketConnection() {
	const [connected, setConnected] = useState(false);

	useEffect(() => {
		wsClient.connect();

		const unsubConnected = wsClient.on("connected", () => setConnected(true));
		const unsubDisconnected = wsClient.on("disconnected", () =>
			setConnected(false),
		);

		return () => {
			unsubConnected();
			unsubDisconnected();
		};
	}, []);

	return { connected };
}

export function useRealtimeEvents(maxEvents = 5) {
	const [events, setEvents] = useState<RealtimeEvent[]>([]);

	const addEvent = useCallback(
		(event: RealtimeEvent) => {
			setEvents((prev) => [event, ...prev].slice(0, maxEvents));
		},
		[maxEvents],
	);

	useEffect(() => {
		const unsubRoborock = wsClient.on(
			"roborock:status",
			(data: Record<string, unknown>) => {
				addEvent({
					type: "vacuum_status",
					deviceId: data.deviceId as string,
					state: data.state as RoborockDeviceState,
					timestamp: new Date(),
				});
			},
		);

		const unsubRingMotion = wsClient.on(
			"ring:motion",
			(data: Record<string, unknown>) => {
				addEvent({
					type: "motion",
					deviceId: data.deviceId as string,
					deviceName: data.deviceName as string,
					timestamp: new Date(),
				});
			},
		);

		const unsubRingDing = wsClient.on(
			"ring:ding",
			(data: Record<string, unknown>) => {
				addEvent({
					type: "doorbell",
					deviceId: data.deviceId as string,
					deviceName: data.deviceName as string,
					timestamp: new Date(),
				});
			},
		);

		return () => {
			unsubRoborock();
			unsubRingMotion();
			unsubRingDing();
		};
	}, [addEvent]);

	return { events };
}
