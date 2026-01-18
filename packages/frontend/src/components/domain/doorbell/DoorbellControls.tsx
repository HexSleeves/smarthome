import { AlertTriangle, Sun } from "lucide-react";
import { useRingControls } from "@/hooks";
import type { RingDeviceState } from "@smarthome/shared";

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
		<div>
			<h3 className="text-sm font-medium text-gray-500 mb-3">Controls</h3>
			<div className="flex flex-wrap gap-3">
				{device.hasLight && (
					<button
						onClick={() => toggleLight(true)}
						disabled={!isAdmin || isPending}
						className="btn btn-secondary flex items-center gap-2"
						type="button"
					>
						<Sun className="w-4 h-4" />
						Turn Light On
					</button>
				)}
				{device.hasSiren && (
					<button
						onClick={() => triggerSiren()}
						disabled={!isAdmin || isPending}
						className="btn btn-danger flex items-center gap-2"
						type="button"
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
	);
}
