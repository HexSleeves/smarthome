import { create } from "zustand";
import { persist } from "zustand/middleware";

type NotificationSettings = {
	enabled: boolean;
	doorbellAlerts: boolean;
	motionAlerts: boolean;
	vacuumAlerts: boolean;
};

type NotificationStore = NotificationSettings & {
	setEnabled: (enabled: boolean) => void;
	setDoorbellAlerts: (enabled: boolean) => void;
	setMotionAlerts: (enabled: boolean) => void;
	setVacuumAlerts: (enabled: boolean) => void;
	toggleSetting: (key: keyof NotificationSettings) => void;
};

export const useNotificationStore = create<NotificationStore>()(
	persist(
		(set) => ({
			enabled: false,
			doorbellAlerts: true,
			motionAlerts: true,
			vacuumAlerts: false,
			setEnabled: (enabled) => set({ enabled }),
			setDoorbellAlerts: (doorbellAlerts) => set({ doorbellAlerts }),
			setMotionAlerts: (motionAlerts) => set({ motionAlerts }),
			setVacuumAlerts: (vacuumAlerts) => set({ vacuumAlerts }),
			toggleSetting: (key) =>
				set((state) => ({ [key]: !state[key] })),
		}),
		{
			name: "smarthome-notifications",
		},
	),
);
