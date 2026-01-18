import { useCallback, useRef, useState } from "react";
import { trpc } from "@/lib/trpc/client";

export type StreamState = "idle" | "connecting" | "streaming" | "error";

export function useRingStream(deviceId: string) {
	const [state, setState] = useState<StreamState>("idle");
	const [error, setError] = useState<string | null>(null);
	const sessionIdRef = useRef<string | null>(null);
	const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
	const videoRef = useRef<HTMLVideoElement | null>(null);

	const startStreamMutation = trpc.ring.startStream.useMutation();
	const stopStreamMutation = trpc.ring.stopStream.useMutation();

	const startStream = useCallback(
		async (videoElement: HTMLVideoElement) => {
			if (state === "streaming" || state === "connecting") {
				return;
			}

			setState("connecting");
			setError(null);
			videoRef.current = videoElement;

			try {
				// Create peer connection with STUN servers
				const pc = new RTCPeerConnection({
					iceServers: [
						{ urls: "stun:stun.l.google.com:19302" },
						{ urls: "stun:stun1.l.google.com:19302" },
					],
				});
				peerConnectionRef.current = pc;

				// Handle incoming tracks
				pc.ontrack = (event) => {
					if (videoRef.current && event.streams[0]) {
						videoRef.current.srcObject = event.streams[0];
						videoRef.current.play().catch(console.error);
						setState("streaming");
					}
				};

				// Handle connection state changes
				pc.onconnectionstatechange = () => {
					if (
						pc.connectionState === "failed" ||
						pc.connectionState === "disconnected"
					) {
						setState("error");
						setError("Connection lost");
					}
				};

				// Add transceivers for receiving audio and video
				pc.addTransceiver("video", { direction: "recvonly" });
				pc.addTransceiver("audio", { direction: "recvonly" });

				// Create offer
				const offer = await pc.createOffer();
				await pc.setLocalDescription(offer);

				// Wait for ICE gathering to complete (or timeout)
				await new Promise<void>((resolve) => {
					const timeout = setTimeout(resolve, 2000);
					if (pc.iceGatheringState === "complete") {
						clearTimeout(timeout);
						resolve();
					} else {
						pc.onicegatheringstatechange = () => {
							if (pc.iceGatheringState === "complete") {
								clearTimeout(timeout);
								resolve();
							}
						};
					}
				});

				// Send offer to server and get answer
				const sdpOffer = pc.localDescription?.sdp;
				if (!sdpOffer) {
					throw new Error("Failed to create SDP offer");
				}

				const result = await startStreamMutation.mutateAsync({
					deviceId,
					sdpOffer,
				});

				if (!result.success || !result.sdpAnswer) {
					throw new Error(result.error || "Failed to start stream");
				}

				sessionIdRef.current = result.sessionId ?? null;

				// Set remote description
				await pc.setRemoteDescription({
					type: "answer",
					sdp: result.sdpAnswer,
				});
			} catch (err) {
				console.error("Failed to start stream:", err);
				setState("error");
				setError(err instanceof Error ? err.message : "Failed to start stream");
				cleanup();
			}
		},
		[deviceId, state, startStreamMutation],
	);

	const cleanup = useCallback(() => {
		if (peerConnectionRef.current) {
			peerConnectionRef.current.close();
			peerConnectionRef.current = null;
		}
		if (videoRef.current) {
			videoRef.current.srcObject = null;
		}
	}, []);

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
