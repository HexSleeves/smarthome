import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Bell,
	Camera,
	Sun,
	AlertTriangle,
	Battery,
	Video,
	RefreshCw,
	Loader2,
	Clock,
} from "lucide-react";
import { ringApi } from "@/lib/api";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { wsClient } from "@/lib/websocket";

export function DoorbellPage() {
	const { user } = useAuthStore();
	const isAdmin = user?.role === "admin";

	const { data: statusData } = useQuery({
		queryKey: ["ring-status"],
		queryFn: ringApi.status,
	});

	const { data: devicesData, isLoading } = useQuery({
		queryKey: ["ring-devices"],
		queryFn: ringApi.devices,
		enabled: statusData?.connected,
		refetchInterval: 30000,
	});

	const devices = devicesData?.devices || [];

	if (!statusData?.connected && !statusData?.hasCredentials) {
		return (
			<div className="card p-8 text-center">
				<Bell className="w-16 h-16 mx-auto mb-4 text-gray-400" />
				<h2 className="text-xl font-semibold mb-2">No Doorbell Connected</h2>
				<p className="text-gray-500 mb-4">
					Connect your Ring doorbell in Settings to get started.
				</p>
				<a href="/settings" className="btn btn-primary">
					Go to Settings
				</a>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Loader2 className="w-8 h-8 animate-spin text-primary-600" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{devices.length === 0 ? (
				<div className="card p-8 text-center">
					<Bell className="w-16 h-16 mx-auto mb-4 text-gray-400" />
					<h2 className="text-xl font-semibold mb-2">No Devices Found</h2>
					<p className="text-gray-500">
						Make sure your Ring device is set up in the Ring app.
					</p>
				</div>
			) : (
				devices.map((device: any) => (
					<DoorbellDevice key={device.id} device={device} isAdmin={isAdmin} />
				))
			)}
		</div>
	);
}

function DoorbellDevice({
	device,
	isAdmin,
}: {
	device: any;
	isAdmin: boolean;
}) {
	const [snapshotKey, setSnapshotKey] = useState(0);
	const [notifications, setNotifications] = useState<any[]>([]);

	// Listen for real-time events
	useEffect(() => {
		const unsubMotion = wsClient.on("ring:motion", (data) => {
			if (data.deviceId === device.id) {
				setNotifications((prev) =>
					[{ type: "motion", time: new Date(), ...data }, ...prev].slice(0, 5),
				);
			}
		});

		const unsubDing = wsClient.on("ring:ding", (data) => {
			if (data.deviceId === device.id) {
				setNotifications((prev) =>
					[{ type: "ding", time: new Date(), ...data }, ...prev].slice(0, 5),
				);
			}
		});

		return () => {
			unsubMotion();
			unsubDing();
		};
	}, [device.id]);

	const { data: historyData } = useQuery({
		queryKey: ["ring-history", device.id],
		queryFn: () => ringApi.history(device.id, 10),
	});

	const lightMutation = useMutation({
		mutationFn: (on: boolean) => ringApi.toggleLight(device.id, on),
	});

	const sirenMutation = useMutation({
		mutationFn: () => ringApi.triggerSiren(device.id),
	});

	const snapshotUrl = ringApi.snapshotUrl(device.id) + `&t=${snapshotKey}`;

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
								className={`w-3 h-3 rounded-full ${device.status === "online" ? "bg-green-500" : "bg-gray-400"}`}
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
			{notifications.length > 0 && (
				<div className="px-6 py-3 bg-yellow-50 dark:bg-yellow-900/30 border-b border-yellow-100 dark:border-yellow-900">
					<div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
						<AlertTriangle className="w-5 h-5" />
						<span className="font-medium">Recent Activity</span>
					</div>
					<div className="mt-2 space-y-1">
						{notifications.map((notif, i) => (
							<div
								key={i}
								className="text-sm text-yellow-600 dark:text-yellow-300"
							>
								{notif.type === "ding"
									? "🔔 Doorbell pressed"
									: "🚶 Motion detected"}
								{" - "}
								{new Date(notif.time).toLocaleTimeString()}
							</div>
						))}
					</div>
				</div>
			)}

			{/* Snapshot */}
			<div className="p-6 bg-gray-900">
				<div className="relative aspect-video bg-black rounded-lg overflow-hidden">
					<img
						src={snapshotUrl}
						alt="Camera snapshot"
						className="w-full h-full object-contain"
						onError={(e) => {
							(e.target as HTMLImageElement).style.display = "none";
						}}
					/>
					<div className="absolute bottom-4 right-4 flex gap-2">
						<button
							onClick={() => setSnapshotKey((k) => k + 1)}
							className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
							title="Refresh snapshot"
						>
							<RefreshCw className="w-5 h-5" />
						</button>
					</div>
					<div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600 text-white text-sm">
						<Video className="w-4 h-4" />
						Live
					</div>
				</div>
				<p className="text-center text-gray-400 text-sm mt-2">
					Snapshot view - Full live streaming requires WebRTC setup
				</p>
			</div>

			{/* Controls */}
			<div className="p-6 space-y-6">
				<div>
					<h3 className="text-sm font-medium text-gray-500 mb-3">Controls</h3>
					<div className="flex flex-wrap gap-3">
						{device.hasLight && (
							<button
								onClick={() => lightMutation.mutate(true)}
								disabled={!isAdmin || lightMutation.isPending}
								className="btn btn-secondary flex items-center gap-2"
							>
								<Sun className="w-4 h-4" />
								Turn Light On
							</button>
						)}
						{device.hasSiren && (
							<button
								onClick={() => sirenMutation.mutate()}
								disabled={!isAdmin || sirenMutation.isPending}
								className="btn btn-danger flex items-center gap-2"
							>
								<AlertTriangle className="w-4 h-4" />
								Trigger Siren
							</button>
						)}
					</div>
					{!isAdmin && (
						<p className="text-sm text-gray-500 mt-2">
							Admin access required for controls.
						</p>
					)}
				</div>

				{/* Event History */}
				{historyData?.history && historyData.history.length > 0 && (
					<div>
						<h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
							<Clock className="w-4 h-4" />
							Recent Events
						</h3>
						<div className="space-y-2">
							{historyData.history.map((event: any, i: number) => (
								<div
									key={i}
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
				)}
			</div>
		</div>
	);
}
