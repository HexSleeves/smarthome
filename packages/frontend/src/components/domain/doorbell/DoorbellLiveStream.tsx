import {
	AlertCircle,
	Loader2,
	Play,
	Square,
	Video,
	VideoOff,
} from "lucide-react";
import { useEffect, useRef } from "react";
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
		<div className="p-6 bg-gray-900">
			<div className="relative aspect-video bg-black rounded-lg overflow-hidden">
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
						<VideoOff className="w-16 h-16 text-gray-500" />
						<p className="text-gray-400">Click to start live stream</p>
						<button
							onClick={handleStartStream}
							className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
							type="button"
						>
							<Play className="w-5 h-5" />
							Start Live Stream
						</button>
					</div>
				)}

				{/* Connecting state */}
				{isConnecting && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
						<Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
						<p className="text-gray-400">Connecting to camera...</p>
					</div>
				)}

				{/* Error state */}
				{state === "error" && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
						<AlertCircle className="w-12 h-12 text-red-500" />
						<p className="text-red-400">{error || "Stream error"}</p>
						<button
							onClick={handleStartStream}
							className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
							type="button"
						>
							Retry
						</button>
					</div>
				)}

				{/* Controls overlay when streaming */}
				{isStreaming && (
					<>
						{/* Live indicator */}
						<div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600 text-white text-sm">
							<span className="w-2 h-2 bg-white rounded-full animate-pulse" />
							<Video className="w-4 h-4" />
							LIVE
						</div>

						{/* Stop button */}
						<div className="absolute bottom-4 right-4">
							<button
								onClick={stopStream}
								className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
								type="button"
							>
								<Square className="w-4 h-4" />
								Stop
							</button>
						</div>
					</>
				)}
			</div>

			<p className="text-center text-gray-400 text-sm mt-2">
				{isStreaming
					? "Live HLS stream from your Ring device"
					: "HLS live streaming - click to start"}
			</p>
		</div>
	);
}
