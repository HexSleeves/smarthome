import type { WebSocket } from "@fastify/websocket";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ringService } from "../services/ring.js";
import { roborockService } from "../services/roborock.js";
import type { JwtPayload, WsIncomingMessage } from "../types.js";

interface WsClient {
	ws: WebSocket;
	userId: string;
	unsubscribers: (() => void)[];
}

const clients: Map<WebSocket, WsClient> = new Map();

export async function websocketRoutes(fastify: FastifyInstance) {
	// Setup Roborock event forwarding
	roborockService.on("statusUpdate", ({ userId, deviceId, state }) => {
		broadcastToUser(userId, {
			type: "roborock:status",
			deviceId,
			state,
		});
	});

	// Note: In @fastify/websocket v11+, the handler receives (socket, request) directly
	// socket IS the WebSocket instance (not connection.socket)
	fastify.get("/events", { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
		// Verify auth token from query string
		const url = new URL(request.url, `http://${request.headers.host}`);
		const token = url.searchParams.get("token");

		if (!token) {
			socket.send(JSON.stringify({ type: "error", message: "Token required" }));
			socket.close();
			return;
		}

		let decoded: JwtPayload;
		try {
			decoded = fastify.jwt.verify<JwtPayload>(token);
		} catch (error) {
			fastify.log.warn({ err: error }, "WebSocket auth failed");
			socket.send(JSON.stringify({ type: "error", message: "Invalid token" }));
			socket.close();
			return;
		}

		const client: WsClient = {
			ws: socket,
			userId: decoded.id,
			unsubscribers: [],
		};

		clients.set(socket, client);

		// Subscribe to Ring events
		if (ringService.isConnected(decoded.id)) {
			const unsubscribe = ringService.subscribeToEvents(
				decoded.id,
				(event) => {
					const { type: eventType, ...rest } = event;
					if (socket.readyState === socket.OPEN) {
						socket.send(
							JSON.stringify({
								type: `ring:${eventType}`,
								...rest,
							}),
						);
					}
				},
			);
			client.unsubscribers.push(unsubscribe);
		}

		socket.send(JSON.stringify({ type: "connected", userId: decoded.id }));

		// Handle incoming messages - attach synchronously!
		socket.on("message", (data: Buffer) => {
			try {
				const message = JSON.parse(data.toString());
				handleMessage(client, message, fastify);
			} catch (error) {
				fastify.log.error({ err: error }, "WS message error");
			}
		});

		socket.on("close", () => {
			// Cleanup subscriptions
			const clientData = clients.get(socket);
			if (clientData) {
				clientData.unsubscribers.forEach((unsub) => unsub());
				clients.delete(socket);
			}
		});

		socket.on("error", (error: Error) => {
			fastify.log.error({ err: error }, "WebSocket error");
			clients.delete(socket);
		});
	});
}

function handleMessage(client: WsClient, message: WsIncomingMessage, fastify: FastifyInstance) {
	switch (message.type) {
		case "ping":
			if (client.ws.readyState === client.ws.OPEN) {
				client.ws.send(JSON.stringify({ type: "pong" }));
			}
			break;

		case "subscribe:ring":
			// Re-subscribe to Ring events
			if (ringService.isConnected(client.userId)) {
				const unsubscribe = ringService.subscribeToEvents(
					client.userId,
					(event) => {
						const { type: eventType, ...rest } = event;
						if (client.ws.readyState === client.ws.OPEN) {
							client.ws.send(
								JSON.stringify({
									type: `ring:${eventType}`,
									...rest,
								}),
							);
						}
					},
				);
				client.unsubscribers.push(unsubscribe);
				if (client.ws.readyState === client.ws.OPEN) {
					client.ws.send(JSON.stringify({ type: "subscribed", service: "ring" }));
				}
			}
			break;

		case "unsubscribe:ring":
			// Would need to track which unsubscribers are for which service
			break;

		default:
			if (client.ws.readyState === client.ws.OPEN) {
				client.ws.send(
					JSON.stringify({ type: "error", message: "Unknown message type" }),
				);
			}
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

export function broadcast(message: object) {
	const payload = JSON.stringify(message);

	for (const [socket] of clients) {
		if (socket.readyState === socket.OPEN) {
			socket.send(payload);
		}
	}
}
