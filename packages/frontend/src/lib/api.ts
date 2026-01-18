// Token management - auth handled via tRPC (stores/auth.ts)

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

// Ring snapshot needs REST URL for <img src>
export function getRingSnapshotUrl(deviceId: string) {
	return `/api/ring/devices/${deviceId}/snapshot?token=${accessToken}`;
}
