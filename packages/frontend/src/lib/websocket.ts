import { getAccessToken } from "./api";

type EventCallback = (data: any) => void;

class WebSocketClient {
	private ws: WebSocket | null = null;
	private reconnectTimer: number | null = null;
	private listeners: Map<string, Set<EventCallback>> = new Map();
	private isConnecting = false;

	connect() {
		if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) return;

		const token = getAccessToken();
		if (!token) return;

		this.isConnecting = true;
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const wsUrl = `${protocol}//${window.location.host}/api/ws/events?token=${token}`;

		this.ws = new WebSocket(wsUrl);

		this.ws.onopen = () => {
			console.log("WebSocket connected");
			this.isConnecting = false;
			this.emit("connected", {});
		};

		this.ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				this.emit(data.type, data);
			} catch (e) {
				console.error("Failed to parse WS message:", e);
			}
		};

		this.ws.onclose = () => {
			console.log("WebSocket disconnected");
			this.isConnecting = false;
			this.emit("disconnected", {});
			this.scheduleReconnect();
		};

		this.ws.onerror = (error) => {
			console.error("WebSocket error:", error);
			this.isConnecting = false;
		};
	}

	disconnect() {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}

	private scheduleReconnect() {
		if (this.reconnectTimer) return;
		this.reconnectTimer = window.setTimeout(() => {
			this.reconnectTimer = null;
			this.connect();
		}, 5000);
	}

	send(type: string, data: any = {}) {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({ type, ...data }));
		}
	}

	on(event: string, callback: EventCallback) {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(callback);

		return () => {
			this.listeners.get(event)?.delete(callback);
		};
	}

	private emit(event: string, data: any) {
		this.listeners.get(event)?.forEach((callback) => callback(data));
		this.listeners.get("*")?.forEach((callback) => callback({ event, data }));
	}
}

export const wsClient = new WebSocketClient();
