import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
			"@smarthome/shared": resolve(__dirname, "../shared/src"),
		},
	},
	server: {
		proxy: {
			"/api": {
				target: "http://localhost:8000",
				changeOrigin: true,
			},
		},
	},
	build: {
		// hls.js is 520KB but lazy-loaded only when viewing live streams
		chunkSizeWarningLimit: 550,
		rollupOptions: {
			output: {
				manualChunks: {
					// Core React libraries
					"vendor-react": ["react", "react-dom", "react-router-dom"],
					// UI libraries
					"vendor-ui": [
						"@radix-ui/react-avatar",
						"@radix-ui/react-dialog",
						"@radix-ui/react-label",
						"@radix-ui/react-separator",
						"@radix-ui/react-slot",
						"@radix-ui/react-tabs",
						"@radix-ui/react-tooltip",
						"class-variance-authority",
						"clsx",
						"tailwind-merge",
					],
					// Data fetching
					"vendor-data": [
						"@tanstack/react-query",
						"@tanstack/react-form",
						"@trpc/client",
						"@trpc/react-query",
						"superjson",
					],
					// State management
					"vendor-state": ["zustand"],
					// Icons
					"vendor-icons": ["lucide-react"],
					// Note: hls.js is dynamically imported and will be split automatically
				},
			},
		},
	},
});
