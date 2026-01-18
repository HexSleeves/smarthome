/**
 * Token management for authentication.
 * Auth is handled via tRPC (see stores/auth.ts and lib/trpc/vanilla.ts)
 */

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

export function getRefreshToken() {
	return refreshToken;
}

/**
 * Ring snapshot URL helper.
 * This needs to be a REST URL with token in query string for use in <img src>.
 * All other Ring endpoints use tRPC.
 */
export const ringApi = {
	snapshotUrl: (deviceId: string) =>
		`${API_BASE}/ring/devices/${deviceId}/snapshot?token=${accessToken}`,
};
