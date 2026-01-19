import type Hls from "hls.js";
import { useCallback, useRef, useState } from "react";
import { getAccessToken } from "@/lib/api";
import { trpc } from "@/lib/trpc/client";

export type StreamState = "idle" | "connecting" | "streaming" | "error";

export function useRingStream(deviceId: string) {
	const [state, setState] = useState<StreamState>("idle");
	const [error, setError] = useState<string | null>(null);
	const sessionIdRef = useRef<string | null>(null);
	const hlsRef = useRef<Hls | null>(null);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const isStreamingRef = useRef(false);

	const startStreamMutation = trpc.ring.startStream.useMutation();
	const stopStreamMutation = trpc.ring.stopStream.useMutation();

	const cleanup = useCallback(() => {
		if (hlsRef.current) {
			hlsRef.current.destroy();
			hlsRef.current = null;
		}
		if (videoRef.current) {
			videoRef.current.src = "";
		}
		isStreamingRef.current = false;
	}, []);

	const startStream = useCallback(
		async (videoElement: HTMLVideoElement) => {
			console.log(
				"startStream called, isStreamingRef:",
				isStreamingRef.current,
			);

			if (isStreamingRef.current) {
				console.log("Already streaming, returning");
				return;
			}

			isStreamingRef.current = true;
			setState("connecting");
			setError(null);
			videoRef.current = videoElement;

			try {
				console.log("Starting HLS stream...");

				// Request HLS stream from server
				const result = await startStreamMutation.mutateAsync({ deviceId });
				console.log("Server response:", result);

				if (!result.success || !result.streamUrl) {
					throw new Error(result.error || "Failed to start stream");
				}

				sessionIdRef.current = result.sessionId ?? null;

				// Get auth token for stream requests
				const token = getAccessToken() || "";
				const streamUrl = `${result.streamUrl}?token=${encodeURIComponent(token)}`;

				console.log("HLS stream URL:", streamUrl);
				console.log("Token present:", !!token, "Token length:", token.length);

				// Wait for the stream to initialize and first segments to be ready
				// HLS needs time for ffmpeg to start and create first segment
				await new Promise((resolve) => setTimeout(resolve, 5000));

				// Dynamically import HLS.js only when needed
				const { default: Hls } = await import("hls.js");

				if (Hls.isSupported()) {
					const hls = new Hls({
						xhrSetup: (xhr) => {
							// Set auth header for all requests
							xhr.setRequestHeader("Authorization", `Bearer ${token}`);
						},
						enableWorker: true,
						lowLatencyMode: true,
						backBufferLength: 30,
						// Retry settings for initial load
						manifestLoadingRetryDelay: 1000,
						manifestLoadingMaxRetry: 6,
						levelLoadingRetryDelay: 1000,
						levelLoadingMaxRetry: 4,
					});

					hlsRef.current = hls;

					hls.on(Hls.Events.MANIFEST_PARSED, () => {
						console.log("HLS manifest parsed, starting playback");
						videoElement.play().catch(console.error);
						setState("streaming");
					});

					hls.on(Hls.Events.ERROR, (_event, data) => {
						console.error("HLS error:", data);
						if (data.fatal) {
							switch (data.type) {
								case Hls.ErrorTypes.NETWORK_ERROR:
									console.log("Network error, trying to recover...");
									hls.startLoad();
									break;
								case Hls.ErrorTypes.MEDIA_ERROR:
									console.log("Media error, trying to recover...");
									hls.recoverMediaError();
									break;
								default:
									setState("error");
									setError("Stream error: " + data.details);
									isStreamingRef.current = false;
									cleanup();
									break;
							}
						}
					});

					hls.loadSource(streamUrl);
					hls.attachMedia(videoElement);
				} else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
					// Native HLS support (Safari)
					videoElement.src = streamUrl;
					videoElement.addEventListener(
						"loadedmetadata",
						() => {
							videoElement.play().catch(console.error);
							setState("streaming");
						},
						{ once: true },
					);
				} else {
					throw new Error("HLS not supported in this browser");
				}
			} catch (err) {
				console.error("Failed to start stream:", err);
				setState("error");
				setError(err instanceof Error ? err.message : "Failed to start stream");
				isStreamingRef.current = false;
				cleanup();
			}
		},
		[deviceId, startStreamMutation, cleanup],
	);

	const stopStream = useCallback(async () => {
		cleanup();
		setState("idle");
		setError(null);

		try {
			await stopStreamMutation.mutateAsync({ deviceId });
		} catch (err) {
			console.error("Failed to stop stream on server:", err);
		}
		sessionIdRef.current = null;
	}, [deviceId, stopStreamMutation, cleanup]);

	return {
		state,
		error,
		startStream,
		stopStream,
		isConnecting: state === "connecting",
		isStreaming: state === "streaming",
	};
}
