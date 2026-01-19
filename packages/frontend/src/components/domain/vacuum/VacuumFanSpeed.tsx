import { Wind } from "lucide-react";
import { useRoborockCommands } from "@/hooks";
import type { RoborockFanSpeed } from "@smarthome/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const fanSpeeds: { value: RoborockFanSpeed; label: string; icon: string }[] = [
	{ value: "quiet", label: "Quiet", icon: "🤫" },
	{ value: "balanced", label: "Balanced", icon: "⚖️" },
	{ value: "turbo", label: "Turbo", icon: "💨" },
	{ value: "max", label: "Max", icon: "🚀" },
];

type VacuumFanSpeedProps = {
	deviceId: string;
	currentSpeed: RoborockFanSpeed;
	isAdmin: boolean;
};

export function VacuumFanSpeed({
	deviceId,
	currentSpeed,
	isAdmin,
}: VacuumFanSpeedProps) {
	const { setFanSpeed, isPending } = useRoborockCommands(deviceId);

	return (
		<div className="space-y-3">
			<Label className="text-muted-foreground flex items-center gap-2">
				<Wind className="w-4 h-4" />
				Fan Speed
			</Label>
			<div className="flex flex-wrap gap-2">
				{fanSpeeds.map((speed) => (
					<Button
						key={speed.value}
						variant={currentSpeed === speed.value ? "default" : "outline"}
						onClick={() => setFanSpeed(speed.value)}
						disabled={!isAdmin || isPending}
						className={cn(
							currentSpeed === speed.value && "ring-2 ring-primary ring-offset-2"
						)}
					>
						{speed.icon} {speed.label}
					</Button>
				))}
			</div>
		</div>
	);
}
