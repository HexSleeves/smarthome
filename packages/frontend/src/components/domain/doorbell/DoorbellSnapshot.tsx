import { Clock, RefreshCw } from "lucide-react";
import { useState } from "react";
import { getRingSnapshotUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type DoorbellSnapshotProps = {
	deviceId: string;
};

export function DoorbellSnapshot({ deviceId }: DoorbellSnapshotProps) {
	const [snapshotKey, setSnapshotKey] = useState(Date.now());
	const [timestamp, setTimestamp] = useState(new Date());
	const snapshotUrl = `${getRingSnapshotUrl(deviceId)}&t=${snapshotKey}`;

	const handleRefresh = () => {
		setSnapshotKey(Date.now());
		setTimestamp(new Date());
	};

	return (
		<div className="bg-muted rounded-lg overflow-hidden">
			<div className="relative aspect-video bg-black">
				<img
					src={snapshotUrl}
					alt="Camera snapshot"
					className="w-full h-full object-contain"
					onError={(e) => {
						(e.target as HTMLImageElement).style.display = "none";
					}}
				/>
				<div className="absolute bottom-4 right-4">
					<Button
						size="icon"
						variant="secondary"
						onClick={handleRefresh}
						title="Refresh snapshot"
					>
						<RefreshCw className="w-5 h-5" />
					</Button>
				</div>
				<div className="absolute top-4 left-4">
					<Badge variant="secondary" className="gap-1.5 bg-black/60 text-white border-0">
						<Clock className="w-3.5 h-3.5" />
						{timestamp.toLocaleTimeString()}
					</Badge>
				</div>
			</div>
			<p className="text-center text-muted-foreground text-sm p-3">
				Snapshot captured at {timestamp.toLocaleString()}
			</p>
		</div>
	);
}
