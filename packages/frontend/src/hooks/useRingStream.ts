import { useCallback, useRef, useState } from "react";
import { trpc } from "@/lib/trpc/client";

export type StreamState = "idle" | "connecting" | "streaming" | "error";

export function useRingStream(deviceId: string) {
	const [state, setState] = useState<StreamState>("idle");
	const [error, setError] = useState<string | null>(null);
	const sessionIdRef = useRef<string | null>(null);
	const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const isStreamingRef = useRef(false); // Use ref to track streaming state for async code

	const startStreamMutation = trpc.ring.startStream.useMutation();
	const stopStreamMutation = trpc.ring.stopStream.useMutation();

	const cleanup = useCallback(() => {
		if (peerConnectionRef.current) {
			peerConnectionRef.current.close();
			peerConnectionRef.current = null;
		}
		if (videoRef.current) {
			videoRef.current.srcObject = null;
		}
		isStreamingRef.current = false;
	}, []);

	const startStream = useCallback(
		async (videoElement: HTMLVideoElement) => {
			console.log("startStream called, isStreamingRef:", isStreamingRef.current);
			
			// Use ref to check if already streaming (avoids stale closure issue)
			if (isStreamingRef.current) {
				console.log("Already streaming, returning");
				return;
			}

			isStreamingRef.current = true;
			setState("connecting");
			setError(null);
			videoRef.current = videoElement;

			try {
				console.log("Creating RTCPeerConnection");
				const pc = new RTCPeerConnection({
					iceServers: [
						{ urls: "stun:stun.l.google.com:19302" },
						{ urls: "stun:stun1.l.google.com:19302" },
					],
				});
				peerConnectionRef.current = pc;
				console.log("RTCPeerConnection created");

				// Handle incoming tracks
				pc.ontrack = (event) => {
					console.log("ontrack event received", event.streams);
					if (videoRef.current && event.streams[0]) {
						videoRef.current.srcObject = event.streams[0];
						videoRef.current.play().catch(console.error);
						setState("streaming");
					}
				};

				// Handle connection state changes
				pc.onconnectionstatechange = () => {
					console.log("Connection state changed:", pc.connectionState);
					if (
						pc.connectionState === "failed" ||
						pc.connectionState === "disconnected"
					) {
						setState("error");
						setError("Connection lost");
						isStreamingRef.current = false;
					}
				};

				console.log("Adding transceivers");
				// Add transceivers for receiving audio and video
				pc.addTransceiver("video", { direction: "recvonly" });
				pc.addTransceiver("audio", { direction: "recvonly" });

				console.log("Creating offer");
				// Create offer
				const offer = await pc.createOffer();
				await pc.setLocalDescription(offer);
				console.log("Local description set");

				// Wait for ICE gathering to complete (or timeout)
				console.log("Waiting for ICE gathering");
				await new Promise<void>((resolve) => {
					const timeout = setTimeout(() => {
						console.log("ICE gathering timeout");
						resolve();
					}, 2000);
					if (pc.iceGatheringState === "complete") {
						console.log("ICE gathering already complete");
						clearTimeout(timeout);
						resolve();
					} else {
						pc.onicegatheringstatechange = () => {
							console.log("ICE gathering state:", pc.iceGatheringState);
							if (pc.iceGatheringState === "complete") {
								clearTimeout(timeout);
								resolve();
							}
						};
					}
				});

				console.log("ICE gathering done, getting SDP");
				// Send offer to server and get answer
				const sdpOffer = pc.localDescription?.sdp;
				if (!sdpOffer) {
					throw new Error("Failed to create SDP offer");
				}

				console.log("Sending offer to server");
				const result = await startStreamMutation.mutateAsync({
					deviceId,
					sdpOffer,
				});
				console.log("Server response:", result);

				if (!result.success || !result.sdpAnswer) {
					throw new Error(result.error || "Failed to start stream");
				}

				sessionIdRef.current = result.sessionId ?? null;

				console.log("Setting remote description");
				// Set remote description
				await pc.setRemoteDescription({
					type: "answer",
					sdp: result.sdpAnswer,
				});
				console.log("Remote description set, waiting for stream");
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
		const sessionId = sessionIdRef.current;

		cleanup();
		setState("idle");
		setError(null);

		if (sessionId) {
			try {
				await stopStreamMutation.mutateAsync({ deviceId, sessionId });
			} catch (err) {
				console.error("Failed to stop stream on server:", err);
			}
			sessionIdRef.current = null;
		}
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
