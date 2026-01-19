import {
	AlertCircle,
	Loader2,
	Play,
	Square,
	Video,
	VideoOff,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRingStream } from "@/hooks";

type DoorbellLiveStreamProps = {
	deviceId: string;
};

export function DoorbellLiveStream({ deviceId }: DoorbellLiveStreamProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const { state, error, startStream, stopStream, isConnecting, isStreaming } =
		useRingStream(deviceId);

	// Cleanup on unmount only - empty dependency array
	useEffect(() => {
		return () => {
			// This cleanup only runs on unmount
			console.log("Component unmounting, stopping stream");
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleStartStream = () => {
		console.log("handleStartStream called, videoRef:", videoRef.current);
		if (videoRef.current) {
			console.log("Calling startStream...");
			startStream(videoRef.current);
		} else {
			console.log("No videoRef!");
		}
	};

	return (
		<div className="bg-muted rounded-lg overflow-hidden">
			<div className="relative aspect-video bg-black">
				{/* Video element - always present but may be hidden */}
				<video
					ref={videoRef}
					autoPlay
					playsInline
					muted
					className={`w-full h-full object-contain ${
						isStreaming ? "block" : "hidden"
					}`}
				/>

				{/* Idle state - show play button */}
				{state === "idle" && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
						<VideoOff className="w-16 h-16 text-muted-foreground" />
						<p className="text-muted-foreground">Click to start live stream</p>
						<Button onClick={handleStartStream}>
							<Play className="w-5 h-5" />
							Start Live Stream
						</Button>
					</div>
				)}

				{/* Connecting state */}
				{isConnecting && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
						<Loader2 className="w-12 h-12 text-primary animate-spin" />
						<p className="text-muted-foreground">Connecting to camera...</p>
					</div>
				)}

				{/* Error state */}
				{state === "error" && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
						<AlertCircle className="w-12 h-12 text-destructive" />
						<p className="text-destructive">{error || "Stream error"}</p>
						<Button variant="secondary" onClick={handleStartStream}>
							Retry
						</Button>
					</div>
				)}

				{/* Controls overlay when streaming */}
				{isStreaming && (
					<>
						{/* Live indicator */}
						<div className="absolute top-4 left-4">
							<Badge variant="destructive" className="gap-1.5">
								<span className="w-2 h-2 bg-white rounded-full animate-pulse" />
								<Video className="w-4 h-4" />
								LIVE
							</Badge>
						</div>

						{/* Stop button */}
						<div className="absolute bottom-4 right-4">
							<Button variant="destructive" onClick={stopStream}>
								<Square className="w-4 h-4" />
								Stop
							</Button>
						</div>
					</>
				)}
			</div>

			<p className="text-center text-muted-foreground text-sm p-3">
				{isStreaming
					? "Live HLS stream from your Ring device"
					: "HLS live streaming - click to start"}
			</p>
		</div>
	);
}
