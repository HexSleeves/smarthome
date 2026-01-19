import type { RoborockDeviceState } from "@smarthome/shared";

type VacuumStatsProps = {
	device: RoborockDeviceState;
};

export function VacuumStats({ device }: VacuumStatsProps) {
	return (
		<div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-muted/50">
			<div>
				<p className="text-sm text-muted-foreground">Clean Area</p>
				<p className="text-lg font-semibold">
					{device.cleanArea?.toFixed(1) || 0} m²
				</p>
			</div>
			<div>
				<p className="text-sm text-muted-foreground">Clean Time</p>
				<p className="text-lg font-semibold">{device.cleanTime || 0} min</p>
			</div>
			<div>
				<p className="text-sm text-muted-foreground">Fan Speed</p>
				<p className="text-lg font-semibold capitalize">
					{device.fanSpeed || "N/A"}
				</p>
			</div>
			<div>
				<p className="text-sm text-muted-foreground">Water Level</p>
				<p className="text-lg font-semibold capitalize">
					{device.waterLevel || "N/A"}
				</p>
			</div>
		</div>
	);
}
