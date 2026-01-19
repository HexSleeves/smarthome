import type { RoborockDeviceState } from "@smarthome/shared";
import { AlertTriangle, Battery, Wind } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
	return (
		<Card>
			<CardHeader className="pb-4">
				<div className="flex items-center gap-4">
					<div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
						<Wind className="w-8 h-8 text-primary" />
					</div>
					<div className="flex-1">
						<h2 className="text-xl font-semibold">{device.name}</h2>
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
