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
			};
			clients.set(socket, client);

			if (ringService.isConnected(decoded.id)) {
				const unsub = ringService.subscribeToEvents(decoded.id, (event) => {
					const { type: eventType, ...rest } = event;
					if (socket.readyState === socket.OPEN) {
						socket.send(JSON.stringify({ type: `ring:${eventType}`, ...rest }));
					}
				});
				client.unsubscribers.push(unsub);
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
					c.unsubscribers.forEach((u) => u());
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
			if (ringService.isConnected(client.userId)) {
				const unsub = ringService.subscribeToEvents(client.userId, (event) => {
					const { type: eventType, ...rest } = event;
					send({ type: `ring:${eventType}`, ...rest });
				});
				client.unsubscribers.push(unsub);
				send({ type: "subscribed", service: "ring" });
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
