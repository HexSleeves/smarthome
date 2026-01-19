import { Home, Pause, Play, Square, Volume2 } from "lucide-react";
import { useRoborockCommands } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type VacuumControlsProps = {
	deviceId: string;
	isAdmin: boolean;
};

export function VacuumControls({ deviceId, isAdmin }: VacuumControlsProps) {
	const { sendCommand, isPending } = useRoborockCommands(deviceId);

	return (
		<div className="space-y-3">
			<Label className="text-muted-foreground">Controls</Label>
			<div className="flex flex-wrap gap-3">
				<Button
					onClick={() => sendCommand("start")}
					disabled={!isAdmin || isPending}
				>
					<Play className="w-4 h-4" />
					Start
				</Button>
				<Button
					variant="secondary"
					onClick={() => sendCommand("pause")}
					disabled={!isAdmin || isPending}
				>
					<Pause className="w-4 h-4" />
					Pause
				</Button>
				<Button
					variant="secondary"
					onClick={() => sendCommand("stop")}
					disabled={!isAdmin || isPending}
				>
					<Square className="w-4 h-4" />
					Stop
				</Button>
				<Button
					variant="secondary"
					onClick={() => sendCommand("home")}
					disabled={!isAdmin || isPending}
				>
					<Home className="w-4 h-4" />
					Dock
				</Button>
				<Button
					variant="secondary"
					onClick={() => sendCommand("find")}
					disabled={!isAdmin || isPending}
				>
					<Volume2 className="w-4 h-4" />
					Find
				</Button>
			</div>
			{!isAdmin && (
				<p className="text-sm text-muted-foreground">
					Admin access required to control the vacuum.
				</p>
			)}
		</div>
	);
}
