import { RefreshCw, Video } from "lucide-react";
import { useState } from "react";
import { getRingSnapshotUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type DoorbellSnapshotProps = {
	deviceId: string;
};

export function DoorbellSnapshot({ deviceId }: DoorbellSnapshotProps) {
	const [snapshotKey, setSnapshotKey] = useState(0);
	const snapshotUrl = `${getRingSnapshotUrl(deviceId)}&t=${snapshotKey}`;

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
						onClick={() => setSnapshotKey((k) => k + 1)}
						title="Refresh snapshot"
					>
						<RefreshCw className="w-5 h-5" />
					</Button>
				</div>
				<div className="absolute top-4 left-4">
					<Badge variant="destructive" className="gap-1">
						<Video className="w-4 h-4" />
						Live
					</Badge>
				</div>
			</div>
			<p className="text-center text-muted-foreground text-sm p-3">
				Snapshot view - Full live streaming requires WebRTC setup
			</p>
		</div>
	);
}
