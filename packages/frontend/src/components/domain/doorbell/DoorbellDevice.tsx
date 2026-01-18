import type { RingDeviceState } from "@smarthome/shared";
import { Battery, Bell, Camera } from "lucide-react";
import { useState } from "react";
import { DoorbellControls } from "./DoorbellControls";
import { DoorbellHistory } from "./DoorbellHistory";
import { DoorbellLiveStream } from "./DoorbellLiveStream";
import { DoorbellNotifications } from "./DoorbellNotifications";
import { DoorbellSnapshot } from "./DoorbellSnapshot";

type DoorbellDeviceProps = {
	device: RingDeviceState;
	isAdmin: boolean;
};

export function DoorbellDevice({ device, isAdmin }: DoorbellDeviceProps) {
	const [viewMode, setViewMode] = useState<"live" | "snapshot">("live");

	return (
		<div className="card overflow-hidden">
			{/* Header */}
			<div className="p-6 border-b border-gray-200 dark:border-gray-700">
				<div className="flex items-center gap-4">
					<div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
						{device.type === "doorbell" ? (
							<Bell className="w-8 h-8 text-primary-600" />
						) : (
							<Camera className="w-8 h-8 text-primary-600" />
						)}
					</div>
					<div className="flex-1">
						<h2 className="text-xl font-semibold">{device.name}</h2>
						<p className="text-sm text-gray-500 capitalize">{device.type}</p>
					</div>
					<div className="text-right">
						<div className="flex items-center gap-2">
							<div
								className={`w-3 h-3 rounded-full ${
									device.status === "online" ? "bg-green-500" : "bg-gray-400"
								}`}
							/>
							<span className="font-medium capitalize">{device.status}</span>
						</div>
						{device.battery !== null && (
							<div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
								<Battery className="w-4 h-4" />
								{device.battery}%
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Live Notifications */}
			<DoorbellNotifications deviceId={device.id} />

			{/* View Mode Toggle */}
			<div className="flex border-b border-gray-200 dark:border-gray-700">
				<button
					type="button"
					onClick={() => setViewMode("live")}
					className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
						viewMode === "live"
							? "text-primary-600 border-b-2 border-primary-600 bg-primary-50 dark:bg-primary-900/20"
							: "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
					}`}
				>
					Live Stream
				</button>
				<button
					type="button"
					onClick={() => setViewMode("snapshot")}
					className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
						viewMode === "snapshot"
							? "text-primary-600 border-b-2 border-primary-600 bg-primary-50 dark:bg-primary-900/20"
							: "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
					}`}
				>
					Snapshot
				</button>
			</div>

			{/* Video View */}
			{viewMode === "live" ? (
				<DoorbellLiveStream deviceId={device.id} />
			) : (
				<DoorbellSnapshot deviceId={device.id} />
			)}

			{/* Controls & History */}
			<div className="p-6 space-y-6">
				<DoorbellControls device={device} isAdmin={isAdmin} />
				<DoorbellHistory deviceId={device.id} />
			</div>
		</div>
	);
}
