import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { TRPCProvider } from "./lib/trpc/provider"
import App from "./App"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<TRPCProvider>
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</TRPCProvider>
	</React.StrictMode>
)
