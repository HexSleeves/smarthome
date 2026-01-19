import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { TRPCProvider } from "./lib/trpc/provider";
import { applyTheme, useThemeStore } from "./stores/theme";
import "./index.css";

// Apply initial theme before render to avoid flash
applyTheme(useThemeStore.getState().theme);

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

ReactDOM.createRoot(rootElement).render(
	<React.StrictMode>
		<TRPCProvider>
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</TRPCProvider>
	</React.StrictMode>,
);
