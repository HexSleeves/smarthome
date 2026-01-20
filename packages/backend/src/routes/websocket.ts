import type { WebSocket } from "@fastify/websocket";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ringService } from "../services/ring.js";
import { roborockService } from "../services/roborock.js";
import type { JwtPayload, WsIncomingMessage } from "../types.js";

interface WsClient {
	ws: WebSocket;
	userId: string;
	unsubscribers: (() => void)[];
	subscriptions: Set<string>; // Track active subscriptions to prevent duplicates
}

const clients = new Map<WebSocket, WsClient>();

export async function websocketRoutes(fastify: FastifyInstance) {
	roborockService.on("statusUpdate", ({ userId, deviceId, state }) => {
		broadcastToUser(userId, { type: "roborock:status", deviceId, state });
	});

	fastify.get(
		"/events",
		{ websocket: true },
		(socket: WebSocket, request: FastifyRequest) => {
			const url = new URL(request.url, `http://${request.headers.host}`);
			const token = url.searchParams.get("token");

			if (!token) {
				socket.send(
					JSON.stringify({ type: "error", message: "Token required" }),
				);
				socket.close();
				return;
			}

			let decoded: JwtPayload;
			try {
				decoded = fastify.jwt.verify<JwtPayload>(token);
			} catch (error) {
				fastify.log.warn({ err: error }, "WebSocket auth failed");
				socket.send(
					JSON.stringify({ type: "error", message: "Invalid token" }),
				);
				socket.close();
				return;
			}

			const client: WsClient = {
				ws: socket,
				userId: decoded.id,
				unsubscribers: [],
				subscriptions: new Set(),
			};
			clients.set(socket, client);

			// Auto-subscribe to Ring events if connected
			if (ringService.isConnected(decoded.id)) {
				subscribeClientToRing(client);
			}

			socket.send(JSON.stringify({ type: "connected", userId: decoded.id }));

			socket.on("message", (data: Buffer) => {
				try {
					handleMessage(client, JSON.parse(data.toString()));
				} catch (error) {
					fastify.log.error({ err: error }, "WS message error");
				}
			});

			socket.on("close", () => {
				const c = clients.get(socket);
				if (c) {
					c.unsubscribers.forEach((u) => {
						u();
					});
					clients.delete(socket);
				}
			});

			socket.on("error", (error: Error) => {
				fastify.log.error({ err: error }, "WebSocket error");
				clients.delete(socket);
			});
		},
	);
}

/**
 * Subscribe a client to Ring events if not already subscribed
 */
function subscribeClientToRing(client: WsClient): boolean {
	// Prevent duplicate subscriptions
	if (client.subscriptions.has("ring")) {
		return false;
	}

	if (!ringService.isConnected(client.userId)) {
		return false;
	}

	const unsub = ringService.subscribeToEvents(client.userId, (event) => {
		const { type: eventType, ...rest } = event;
		if (client.ws.readyState === client.ws.OPEN) {
			client.ws.send(JSON.stringify({ type: `ring:${eventType}`, ...rest }));
		}
	});

	client.unsubscribers.push(unsub);
	client.subscriptions.add("ring");
	return true;
}

/**
 * Unsubscribe a client from Ring events
 */
function unsubscribeClientFromRing(client: WsClient): boolean {
	if (!client.subscriptions.has("ring")) {
		return false;
	}

	// Call all unsubscribers and clear them
	// Note: This unsubscribes from ALL services, which is a limitation
	// In a more complex system, we'd track per-service unsubscribers
	for (const unsub of client.unsubscribers) {
		unsub();
	}
	client.unsubscribers = [];
	client.subscriptions.delete("ring");
	return true;
}

function handleMessage(client: WsClient, message: WsIncomingMessage) {
	const send = (msg: object) => {
		if (client.ws.readyState === client.ws.OPEN) {
			client.ws.send(JSON.stringify(msg));
		}
	};

	switch (message.type) {
		case "ping":
			send({ type: "pong" });
			break;
		case "subscribe:ring":
			if (client.subscriptions.has("ring")) {
				send({ type: "subscribed", service: "ring", alreadySubscribed: true });
			} else if (subscribeClientToRing(client)) {
				send({ type: "subscribed", service: "ring" });
			} else {
				send({ type: "error", message: "Ring not connected" });
			}
			break;
		case "unsubscribe:ring":
			if (unsubscribeClientFromRing(client)) {
				send({ type: "unsubscribed", service: "ring" });
			} else {
				send({ type: "error", message: "Not subscribed to Ring" });
			}
			break;
		default:
			send({ type: "error", message: "Unknown message type" });
	}
}

function broadcastToUser(userId: string, message: object) {
	const payload = JSON.stringify(message);
	for (const [socket, client] of clients) {
		if (client.userId === userId && socket.readyState === socket.OPEN) {
			socket.send(payload);
		}
	}
}
