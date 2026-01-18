import { create } from "zustand";
import { clearTokens, getRefreshToken, setTokens } from "@/lib/api";
import { trpcVanilla } from "@/lib/trpc/vanilla";

interface User {
	id: string;
	email: string;
	name: string | null;
	role: "admin" | "viewer";
}

interface AuthState {
	user: User | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	login: (email: string, password: string) => Promise<void>;
	register: (email: string, password: string, name?: string) => Promise<void>;
	logout: () => Promise<void>;
	checkAuth: () => Promise<void>;
	refreshAccessToken: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
	user: null,
	isLoading: true,
	isAuthenticated: false,

	login: async (email, password) => {
		const data = await trpcVanilla.auth.login.mutate({ email, password });
		setTokens(data.accessToken, data.refreshToken);
		set({ user: data.user, isAuthenticated: true });
	},

	register: async (email, password, name) => {
		const data = await trpcVanilla.auth.register.mutate({ email, password, name });
		setTokens(data.accessToken, data.refreshToken);
		set({ user: data.user, isAuthenticated: true });
	},

	logout: async () => {
		try {
			const refreshToken = getRefreshToken();
			await trpcVanilla.auth.logout.mutate({ refreshToken: refreshToken || undefined });
		} catch {
			// Ignore errors - clear local state anyway
		}
		clearTokens();
		set({ user: null, isAuthenticated: false });
	},

	checkAuth: async () => {
		set({ isLoading: true });
		try {
			const user = await trpcVanilla.auth.me.query();
			set({ user: user as User, isAuthenticated: true, isLoading: false });
		} catch {
			// Try to refresh the token
			const refreshed = await get().refreshAccessToken();
			if (refreshed) {
				try {
					const user = await trpcVanilla.auth.me.query();
					set({ user: user as User, isAuthenticated: true, isLoading: false });
					return;
				} catch {
					// Fall through to clear tokens
				}
			}
			clearTokens();
			set({ user: null, isAuthenticated: false, isLoading: false });
		}
	},

	refreshAccessToken: async () => {
		const refreshToken = getRefreshToken();
		if (!refreshToken) return false;

		try {
			const data = await trpcVanilla.auth.refresh.mutate({ refreshToken });
			setTokens(data.accessToken, refreshToken);
			return true;
		} catch {
			clearTokens();
			return false;
		}
	},
}));
