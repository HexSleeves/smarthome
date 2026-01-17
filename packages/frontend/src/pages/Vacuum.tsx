import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	Battery,
	Droplets,
	Home,
	Loader2,
	Pause,
	Play,
	Square,
	Volume2,
	Wind,
} from "lucide-react";
import { clsx } from "clsx";
import { roborockApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { RoborockDeviceState } from "@/types";

export function VacuumPage() {
	const { user } = useAuthStore();
	const isAdmin = user?.role === "admin";

	const { data: statusData } = useQuery({
		queryKey: ["roborock-status"],
		queryFn: roborockApi.status,
	});

	const { data: devicesData, isLoading } = useQuery({
		queryKey: ["roborock-devices"],
		queryFn: roborockApi.devices,
		enabled: statusData?.connected,
		refetchInterval: 10000, // Refresh every 10 seconds
	});

	const devices = devicesData?.devices || [];

	if (!statusData?.connected && !statusData?.hasCredentials) {
		return (
			<div className="card p-8 text-center">
				<Wind className="w-16 h-16 mx-auto mb-4 text-gray-400" />
				<h2 className="text-xl font-semibold mb-2">No Vacuum Connected</h2>
				<p className="text-gray-500 mb-4">
					Connect your Roborock vacuum in Settings to get started.
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
					<Wind className="w-16 h-16 mx-auto mb-4 text-gray-400" />
					<h2 className="text-xl font-semibold mb-2">No Devices Found</h2>
					<p className="text-gray-500">
						Make sure your vacuum is set up in the Roborock app.
					</p>
				</div>
			) : (
				devices.map((device: RoborockDeviceState) => (
					<VacuumDevice key={device.id} device={device} isAdmin={isAdmin} />
				))
			)}
		</div>
	);
}

function VacuumDevice({
	device,
	isAdmin,
}: {
	device: RoborockDeviceState;
	isAdmin: boolean;
}) {
	const queryClient = useQueryClient();

	const commandMutation = useMutation({
		mutationFn: (command: string) => roborockApi.command(device.id, command),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["roborock-devices"] });
		},
	});

	const fanSpeedMutation = useMutation({
		mutationFn: (speed: string) => roborockApi.setFanSpeed(device.id, speed),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["roborock-devices"] });
		},
	});

	const waterLevelMutation = useMutation({
		mutationFn: (level: string) => roborockApi.setWaterLevel(device.id, level),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["roborock-devices"] });
		},
	});

	const statusColors: Record<string, string> = {
		idle: "bg-gray-500",
		cleaning: "bg-green-500",
		returning: "bg-blue-500",
		charging: "bg-yellow-500",
		paused: "bg-orange-500",
		error: "bg-red-500",
		offline: "bg-gray-400",
	};

	const statusText: Record<string, string> = {
		idle: "Idle",
		cleaning: "Cleaning",
		returning: "Returning to dock",
		charging: "Charging",
		paused: "Paused",
		error: "Error",
		offline: "Offline",
	};

	const fanSpeeds = [
		{ value: "quiet", label: "Quiet", icon: "🤫" },
		{ value: "balanced", label: "Balanced", icon: "⚖️" },
		{ value: "turbo", label: "Turbo", icon: "💨" },
		{ value: "max", label: "Max", icon: "🚀" },
	];

	const waterLevels = [
		{ value: "off", label: "Off" },
		{ value: "low", label: "Low" },
		{ value: "medium", label: "Medium" },
		{ value: "high", label: "High" },
	];

	return (
		<div className="card overflow-hidden">
			{/* Header */}
			<div className="p-6 border-b border-gray-200 dark:border-gray-700">
				<div className="flex items-center gap-4">
					<div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
						<Wind className="w-8 h-8 text-primary-600" />
					</div>
					<div className="flex-1">
						<h2 className="text-xl font-semibold">{device.name}</h2>
						<p className="text-sm text-gray-500">{device.model}</p>
					</div>
					<div className="text-right">
						<div className="flex items-center gap-2">
							<div
								className={`w-3 h-3 rounded-full ${statusColors[device.status]}`}
							/>
							<span className="font-medium">
								{statusText[device.status]}
							</span>
						</div>
						<div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
							<Battery className="w-4 h-4" />
							{device.battery}%
						</div>
					</div>
				</div>
			</div>

			{/* Error message */}
			{device.errorMessage && (
				<div className="px-6 py-3 bg-red-50 dark:bg-red-900/30 flex items-center gap-2 text-red-600 dark:text-red-400">
					<AlertTriangle className="w-5 h-5" />
					<span>{device.errorMessage}</span>
				</div>
			)}

			{/* Stats */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-gray-50 dark:bg-gray-800/50">
				<div>
					<p className="text-sm text-gray-500">Clean Area</p>
					<p className="text-lg font-semibold">
						{device.cleanArea?.toFixed(1) || 0} m²
					</p>
				</div>
				<div>
					<p className="text-sm text-gray-500">Clean Time</p>
					<p className="text-lg font-semibold">{device.cleanTime || 0} min</p>
				</div>
				<div>
					<p className="text-sm text-gray-500">Fan Speed</p>
					<p className="text-lg font-semibold capitalize">
						{device.fanSpeed || "N/A"}
					</p>
				</div>
				<div>
					<p className="text-sm text-gray-500">Water Level</p>
					<p className="text-lg font-semibold capitalize">
						{device.waterLevel || "N/A"}
					</p>
				</div>
			</div>

			{/* Controls */}
			<div className="p-6 space-y-6">
				{/* Main controls */}
				<div>
					<h3 className="text-sm font-medium text-gray-500 mb-3">Controls</h3>
					<div className="flex flex-wrap gap-3">
						<button
							onClick={() => commandMutation.mutate("start")}
							disabled={!isAdmin || commandMutation.isPending}
							className="btn btn-primary flex items-center gap-2"
							type="button"
						>
							<Play className="w-4 h-4" />
							Start
						</button>
						<button
							onClick={() => commandMutation.mutate("pause")}
							disabled={!isAdmin || commandMutation.isPending}
							className="btn btn-secondary flex items-center gap-2"
							type="button"
						>
							<Pause className="w-4 h-4" />
							Pause
						</button>
						<button
							onClick={() => commandMutation.mutate("stop")}
							disabled={!isAdmin || commandMutation.isPending}
							className="btn btn-secondary flex items-center gap-2"
							type="button"
						>
							<Square className="w-4 h-4" />
							Stop
						</button>
						<button
							onClick={() => commandMutation.mutate("home")}
							disabled={!isAdmin || commandMutation.isPending}
							className="btn btn-secondary flex items-center gap-2"
							type="button"
						>
							<Home className="w-4 h-4" />
							Dock
						</button>
						<button
							onClick={() => commandMutation.mutate("find")}
							disabled={!isAdmin || commandMutation.isPending}
							className="btn btn-secondary flex items-center gap-2"
							type="button"
						>
							<Volume2 className="w-4 h-4" />
							Find
						</button>
					</div>
					{!isAdmin && (
						<p className="text-sm text-gray-500 mt-2">
							Admin access required to control the vacuum.
						</p>
					)}
				</div>

				{/* Fan Speed */}
				<div>
					<h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
						<Wind className="w-4 h-4" />
						Fan Speed
					</h3>
					<div className="flex flex-wrap gap-2">
						{fanSpeeds.map((speed) => (
							<button
								key={speed.value}
								onClick={() => fanSpeedMutation.mutate(speed.value)}
								disabled={!isAdmin || fanSpeedMutation.isPending}
								className={clsx(
									"px-4 py-2 rounded-lg border transition-colors",
									device.fanSpeed === speed.value
										? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
										: "border-gray-200 dark:border-gray-600 hover:border-primary-300",
								)}
								type="button"
							>
								{speed.icon} {speed.label}
							</button>
						))}
					</div>
				</div>

				{/* Water Level */}
				<div>
					<h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
						<Droplets className="w-4 h-4" />
						Water Level
					</h3>
					<div className="flex flex-wrap gap-2">
						{waterLevels.map((level) => (
							<button
								key={level.value}
								onClick={() => waterLevelMutation.mutate(level.value)}
								disabled={!isAdmin || waterLevelMutation.isPending}
								className={clsx(
									"px-4 py-2 rounded-lg border transition-colors",
									device.waterLevel === level.value
										? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
										: "border-gray-200 dark:border-gray-600 hover:border-primary-300",
								)}
								type="button"
							>
								{level.label}
							</button>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
