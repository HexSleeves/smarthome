import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { TRPCProvider } from "./lib/trpc/provider";
import { useThemeStore, applyTheme } from "./stores/theme";
import App from "./App";
import "./index.css";

// Apply initial theme before render to avoid flash
applyTheme(useThemeStore.getState().theme);

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<TRPCProvider>
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</TRPCProvider>
	</React.StrictMode>,
);
