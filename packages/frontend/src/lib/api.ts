const API_BASE = "/api";

let accessToken: string | null = localStorage.getItem("accessToken");
let refreshToken: string | null = localStorage.getItem("refreshToken");

export function setTokens(access: string, refresh: string) {
	accessToken = access;
	refreshToken = refresh;
	localStorage.setItem("accessToken", access);
	localStorage.setItem("refreshToken", refresh);
}

export function clearTokens() {
	accessToken = null;
	refreshToken = null;
	localStorage.removeItem("accessToken");
	localStorage.removeItem("refreshToken");
}

export function getAccessToken() {
	return accessToken;
}

async function refreshAccessToken(): Promise<boolean> {
	if (!refreshToken) return false;

	try {
		const res = await fetch(`${API_BASE}/auth/refresh`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken }),
		});

		if (!res.ok) {
			clearTokens();
			return false;
		}

		const data = await res.json();
		accessToken = data.accessToken;
		localStorage.setItem("accessToken", data.accessToken);
		return true;
	} catch {
		clearTokens();
		return false;
	}
}

export async function api<T = any>(
	endpoint: string,
	options: RequestInit = {},
): Promise<T> {
	const url = `${API_BASE}${endpoint}`;

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...(options.headers as Record<string, string>),
	};

	if (accessToken) {
		headers["Authorization"] = `Bearer ${accessToken}`;
	}

	let res = await fetch(url, { ...options, headers });

	// If unauthorized, try to refresh token
	if (res.status === 401 && refreshToken) {
		const refreshed = await refreshAccessToken();
		if (refreshed) {
			headers["Authorization"] = `Bearer ${accessToken}`;
			res = await fetch(url, { ...options, headers });
		}
	}

	if (!res.ok) {
		const error = await res.json().catch(() => ({ error: "Request failed" }));
		throw new Error(error.error || "Request failed");
	}

	return res.json();
}

// Auth endpoints
export const authApi = {
	login: (email: string, password: string) =>
		api<{ user: any; accessToken: string; refreshToken: string }>(
			"/auth/login",
			{
				method: "POST",
				body: JSON.stringify({ email, password }),
			},
		),

	register: (email: string, password: string, name?: string) =>
		api<{ user: any; accessToken: string; refreshToken: string }>(
			"/auth/register",
			{
				method: "POST",
				body: JSON.stringify({ email, password, name }),
			},
		),

	logout: () =>
		api("/auth/logout", {
			method: "POST",
			body: JSON.stringify({ refreshToken }),
		}),

	me: () =>
		api<{ id: string; email: string; name: string; role: string }>("/auth/me"),
};

// Device endpoints
export const deviceApi = {
	list: () => api<{ devices: any[] }>("/devices"),
	get: (id: string) => api<any>(`/devices/${id}`),
	events: (id: string, limit = 50) =>
		api<{ events: any[] }>(`/devices/${id}/events?limit=${limit}`),
	recentEvents: (limit = 20) =>
		api<{ events: any[] }>(`/devices/events/recent?limit=${limit}`),
};

// Roborock endpoints
export const roborockApi = {
	status: () =>
		api<{ connected: boolean; hasCredentials: boolean }>("/roborock/status"),
	auth: (email: string, password: string) =>
		api("/roborock/auth", {
			method: "POST",
			body: JSON.stringify({ email, password }),
		}),
	connect: () => api("/roborock/connect", { method: "POST" }),
	disconnect: () => api("/roborock/disconnect", { method: "POST" }),
	devices: () => api<{ devices: any[] }>("/roborock/devices"),
	command: (deviceId: string, command: string) =>
		api(`/roborock/devices/${deviceId}/command`, {
			method: "POST",
			body: JSON.stringify({ command }),
		}),
	setFanSpeed: (deviceId: string, speed: string) =>
		api(`/roborock/devices/${deviceId}/fan-speed`, {
			method: "POST",
			body: JSON.stringify({ speed }),
		}),
	setWaterLevel: (deviceId: string, level: string) =>
		api(`/roborock/devices/${deviceId}/water-level`, {
			method: "POST",
			body: JSON.stringify({ level }),
		}),
	cleanRooms: (deviceId: string, roomIds: number[]) =>
		api(`/roborock/devices/${deviceId}/clean-rooms`, {
			method: "POST",
			body: JSON.stringify({ roomIds }),
		}),
	history: (deviceId: string) =>
		api<{ history: any[] }>(`/roborock/devices/${deviceId}/history`),
};

// Ring endpoints
export const ringApi = {
	status: () =>
		api<{ connected: boolean; hasCredentials: boolean; pending2FA: boolean }>(
			"/ring/status",
		),
	auth: (email: string, password: string, twoFactorCode?: string) =>
		api<{ success: boolean; requiresTwoFactor?: boolean; prompt?: string }>(
			"/ring/auth",
			{
				method: "POST",
				body: JSON.stringify({ email, password, twoFactorCode }),
			},
		),
	submit2FA: (code: string) =>
		api<{ success: boolean; canRetry?: boolean }>("/ring/auth/2fa", {
			method: "POST",
			body: JSON.stringify({ code }),
		}),
	cancel2FA: () => api("/ring/auth/2fa/cancel", { method: "POST" }),
	connect: () => api("/ring/connect", { method: "POST" }),
	disconnect: () => api("/ring/disconnect", { method: "POST" }),
	devices: () => api<{ devices: any[] }>("/ring/devices"),
	snapshotUrl: (deviceId: string) =>
		`${API_BASE}/ring/devices/${deviceId}/snapshot?token=${accessToken}`,
	history: (deviceId: string, limit = 20) =>
		api<{ history: any[] }>(`/ring/devices/${deviceId}/history?limit=${limit}`),
	toggleLight: (deviceId: string, on: boolean) =>
		api(`/ring/devices/${deviceId}/light`, {
			method: "POST",
			body: JSON.stringify({ on }),
		}),
	triggerSiren: (deviceId: string) =>
		api(`/ring/devices/${deviceId}/siren`, { method: "POST" }),
};
