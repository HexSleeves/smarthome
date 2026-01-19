import { Droplets } from "lucide-react";
import { useRoborockCommands } from "@/hooks";
import type { RoborockWaterLevel } from "@smarthome/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const waterLevels: { value: RoborockWaterLevel; label: string }[] = [
	{ value: "off", label: "Off" },
	{ value: "low", label: "Low" },
	{ value: "medium", label: "Medium" },
	{ value: "high", label: "High" },
];

type VacuumWaterLevelProps = {
	deviceId: string;
	currentLevel: RoborockWaterLevel;
	isAdmin: boolean;
};

export function VacuumWaterLevel({
	deviceId,
	currentLevel,
	isAdmin,
}: VacuumWaterLevelProps) {
	const { setWaterLevel, isPending } = useRoborockCommands(deviceId);

	return (
		<div className="space-y-3">
			<Label className="text-muted-foreground flex items-center gap-2">
				<Droplets className="w-4 h-4" />
				Water Level
			</Label>
			<div className="flex flex-wrap gap-2">
				{waterLevels.map((level) => (
					<Button
						key={level.value}
						variant={currentLevel === level.value ? "default" : "outline"}
						onClick={() => setWaterLevel(level.value)}
						disabled={!isAdmin || isPending}
						className={cn(
							currentLevel === level.value && "ring-2 ring-primary ring-offset-2"
						)}
					>
						{level.label}
					</Button>
				))}
			</div>
		</div>
	);
}
