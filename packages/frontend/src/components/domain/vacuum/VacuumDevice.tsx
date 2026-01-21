import type { RoborockDeviceState } from "@smarthome/shared";
import { AlertTriangle, Battery, Radio, Wind } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useRoborockDeviceLastUpdated } from "@/stores/roborock";
import { VacuumControls } from "./VacuumControls";
import { VacuumFanSpeed } from "./VacuumFanSpeed";
import { VacuumStats } from "./VacuumStats";
import { VacuumStatusBadge } from "./VacuumStatusBadge";
import { VacuumWaterLevel } from "./VacuumWaterLevel";

type VacuumDeviceProps = {
	device: RoborockDeviceState;
	isAdmin: boolean;
};

export function VacuumDevice({ device, isAdmin }: VacuumDeviceProps) {
	const lastUpdatedTimestamp = useRoborockDeviceLastUpdated(device.id);
	const lastUpdated = lastUpdatedTimestamp
		? new Date(lastUpdatedTimestamp)
		: undefined;

	// Track if we recently received an update (for visual feedback)
	const [recentUpdate, setRecentUpdate] = useState(false);

	useEffect(() => {
		if (lastUpdatedTimestamp) {
			setRecentUpdate(true);
			const timer = setTimeout(() => setRecentUpdate(false), 2000);
			return () => clearTimeout(timer);
		}
	}, [lastUpdatedTimestamp]);

	return (
		<Card
			className={cn(
				"transition-all duration-300",
				recentUpdate && "ring-2 ring-primary/50",
			)}
		>
			<CardHeader className="pb-4">
				<div className="flex items-center gap-4">
					<div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
						<Wind className="w-8 h-8 text-primary" />
					</div>
					<div className="flex-1">
						<div className="flex items-center gap-2">
							<h2 className="text-xl font-semibold">{device.name}</h2>
							{/* Live indicator */}
							<div
								className={cn(
									"flex items-center gap-1 text-xs",
									recentUpdate ? "text-primary" : "text-muted-foreground",
								)}
								title={
									lastUpdated
										? `Last update: ${lastUpdated.toLocaleTimeString()}`
										: ""
								}
							>
								<Radio
									className={cn("w-3 h-3", recentUpdate && "animate-pulse")}
								/>
								<span className="sr-only">Live</span>
							</div>
						</div>
						<p className="text-sm text-muted-foreground">{device.model}</p>
					</div>
					<div className="text-right">
						<VacuumStatusBadge status={device.status} />
						<div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
							<Battery className="w-4 h-4" />
							{device.battery}%
						</div>
					</div>
				</div>
			</CardHeader>

			{/* Error message */}
			{device.errorMessage && (
				<div className="px-6">
					<Alert variant="destructive">
						<AlertTriangle className="h-4 w-4" />
						<AlertDescription>{device.errorMessage}</AlertDescription>
					</Alert>
				</div>
			)}

			{/* Stats */}
			<VacuumStats device={device} />

			<Separator />

			{/* Controls */}
			<CardContent className="space-y-6 pt-6">
				<VacuumControls deviceId={device.id} isAdmin={isAdmin} />
				<VacuumFanSpeed
					deviceId={device.id}
					currentSpeed={device.fanSpeed}
					isAdmin={isAdmin}
				/>
				<VacuumWaterLevel
					deviceId={device.id}
					currentLevel={device.waterLevel}
					isAdmin={isAdmin}
				/>
			</CardContent>
		</Card>
	);
}
