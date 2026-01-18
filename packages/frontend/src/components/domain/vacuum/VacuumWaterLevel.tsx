import { Droplets } from "lucide-react";
import { clsx } from "clsx";
import { useRoborockCommands } from "@/hooks";
import type { RoborockWaterLevel } from "@smarthome/shared";

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
		<div>
			<h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
				<Droplets className="w-4 h-4" />
				Water Level
			</h3>
			<div className="flex flex-wrap gap-2">
				{waterLevels.map((level) => (
					<button
						key={level.value}
						onClick={() => setWaterLevel(level.value)}
						disabled={!isAdmin || isPending}
						className={clsx(
							"px-4 py-2 rounded-lg border transition-colors",
							currentLevel === level.value
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
	);
}
