import { CameraEvent } from "ring-client-api";
import type {
	Device,
	DeviceEvent,
	RingDeviceState,
	RoborockDeviceState,
	RoborockCleanHistory,
} from "./device";

// API response types
export type DeviceListResponse = {
	devices: Device[];
};

export type DeviceEventsResponse = {
	events: DeviceEvent[];
};

export type RoborockStatusResponse = {
	connected: boolean;
	hasCredentials: boolean;
};

export type RoborockDevicesResponse = {
	devices: RoborockDeviceState[];
};

export type RoborockHistoryResponse = {
	history: RoborockCleanHistory[];
};

export type RingStatusResponse = {
	connected: boolean;
	hasCredentials: boolean;
	pending2FA: boolean;
};

export type RingAuthResponse = {
	success: boolean;
	requiresTwoFactor?: boolean;
	prompt?: string;
};

export type Ring2FAResponse = {
	success: boolean;
	canRetry?: boolean;
};

export type RingDevicesResponse = {
	devices: RingDeviceState[];
};

export type RingHistoryResponse = {
	history: CameraEvent[];
};
