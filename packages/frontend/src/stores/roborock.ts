import type { RoborockDeviceState } from "@smarthome/shared";
import { create } from "zustand";
import { useShallow } from "zustand/shallow";

interface RoborockState {
	// Store devices as an object (Record) instead of Map for better React compatibility
	devicesById: Record<string, RoborockDeviceState>;
	lastUpdatedById: Record<string, number>; // Use timestamps instead of Date objects

	// Actions
	setDevices: (devices: RoborockDeviceState[]) => void;
	updateDevice: (deviceId: string, update: Partial<RoborockDeviceState>) => void;
	updateDeviceFromWebSocket: (deviceId: string, state: RoborockDeviceState) => void;
	clearDevices: () => void;
}

export const useRoborockStore = create<RoborockState>((set, get) => ({
	devicesById: {},
	lastUpdatedById: {},

	setDevices: (devices) => {
		const now = Date.now();
		const devicesById: Record<string, RoborockDeviceState> = {};
		const lastUpdatedById: Record<string, number> = {};

		for (const device of devices) {
			devicesById[device.id] = device;
			lastUpdatedById[device.id] = now;
		}

		set({ devicesById, lastUpdatedById });
	},

	updateDevice: (deviceId, update) => {
		const { devicesById, lastUpdatedById } = get();
		const existing = devicesById[deviceId];
		if (!existing) return;

		set({
			devicesById: {
				...devicesById,
				[deviceId]: { ...existing, ...update },
			},
			lastUpdatedById: {
				...lastUpdatedById,
				[deviceId]: Date.now(),
			},
		});
	},

	updateDeviceFromWebSocket: (deviceId, state) => {
		const { devicesById, lastUpdatedById } = get();
		const existing = devicesById[deviceId];

		set({
			devicesById: {
				...devicesById,
				[deviceId]: existing ? { ...existing, ...state } : state,
			},
			lastUpdatedById: {
				...lastUpdatedById,
				[deviceId]: Date.now(),
			},
		});
	},

	clearDevices: () => {
		set({ devicesById: {}, lastUpdatedById: {} });
	},
}));

// Helper hook for getting devices as array with proper memoization
export function useRoborockDevicesFromStore() {
	return useRoborockStore(
		useShallow((state) => Object.values(state.devicesById)),
	);
}

// Helper hook for getting a specific device
export function useRoborockDeviceFromStore(deviceId: string) {
	return useRoborockStore((state) => state.devicesById[deviceId]);
}

// Helper hook for getting last updated timestamp
export function useRoborockDeviceLastUpdated(deviceId: string) {
	return useRoborockStore((state) => state.lastUpdatedById[deviceId]);
}
