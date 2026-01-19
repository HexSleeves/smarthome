import { useEffect } from "react";
import {
	getNotificationPermission,
	notifyDoorbell,
	notifyMotion,
	notifyVacuumStatus,
} from "@/lib/notifications";
import { wsClient } from "@/lib/websocket";
import { useNotificationStore } from "@/stores/notifications";

export function useNotifications() {
	const { enabled, doorbellAlerts, motionAlerts, vacuumAlerts } =
		useNotificationStore();

	useEffect(() => {
		if (!enabled || getNotificationPermission() !== "granted") {
			return;
		}

		const unsubscribers: Array<() => void> = [];

		if (doorbellAlerts) {
			unsubscribers.push(
				wsClient.on("ring:ding", (data: Record<string, unknown>) => {
					const deviceName = (data.deviceName as string) || "Front Door";
					notifyDoorbell(deviceName);
				}),
			);
		}

		if (motionAlerts) {
			unsubscribers.push(
				wsClient.on("ring:motion", (data: Record<string, unknown>) => {
					const deviceName = (data.deviceName as string) || "Camera";
					notifyMotion(deviceName);
				}),
			);
		}

		if (vacuumAlerts) {
			unsubscribers.push(
				wsClient.on("roborock:state", (data: Record<string, unknown>) => {
					const state = data.state as Record<string, unknown> | undefined;
					if (state) {
						const deviceName = (state.name as string) || "Vacuum";
						const status = state.status as string;
						if (status) {
							notifyVacuumStatus(deviceName, status);
						}
					}
				}),
			);
		}

		return () => {
			for (const unsub of unsubscribers) {
				unsub();
			}
		};
	}, [enabled, doorbellAlerts, motionAlerts, vacuumAlerts]);
}
