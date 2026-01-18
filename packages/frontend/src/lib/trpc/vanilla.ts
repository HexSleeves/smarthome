import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../../backend/src/trpc/routers/index.js";
import { getAccessToken } from "../api";

/**
 * Vanilla tRPC client for imperative calls (e.g., in zustand stores).
 * Use this when you need to call tRPC outside of React components.
 */
export const trpcVanilla = createTRPCClient<AppRouter>({
	links: [
		httpBatchLink({
			url: "/api/trpc",
			transformer: superjson,
			headers() {
				const token = getAccessToken();
				return token ? { Authorization: `Bearer ${token}` } : {};
			},
		}),
	],
});
