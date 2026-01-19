import type { RingDeviceState } from "@smarthome/shared";
import { AlertTriangle, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRingControls } from "@/hooks";

type DoorbellControlsProps = {
	device: RingDeviceState;
	isAdmin: boolean;
};

export function DoorbellControls({ device, isAdmin }: DoorbellControlsProps) {
	const { toggleLight, triggerSiren, isPending } = useRingControls(device.id);

	if (!device.hasLight && !device.hasSiren) {
		return null;
	}

	return (
		<div className="space-y-3">
			<Label className="text-muted-foreground">Controls</Label>
			<div className="flex flex-wrap gap-3">
				{device.hasLight && (
					<Button
						variant="secondary"
						onClick={() => toggleLight(true)}
						disabled={!isAdmin || isPending}
					>
						<Sun className="w-4 h-4" />
						Turn Light On
					</Button>
				)}
				{device.hasSiren && (
					<Button
						variant="destructive"
						onClick={() => triggerSiren()}
						disabled={!isAdmin || isPending}
					>
						<AlertTriangle className="w-4 h-4" />
						Trigger Siren
					</Button>
				)}
			</div>
			{!isAdmin && (
				<p className="text-sm text-muted-foreground">
					Admin access required for controls.
				</p>
			)}
		</div>
	);
}
