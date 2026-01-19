import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout/AppShell";
import { DashboardPage } from "@/pages/Dashboard";
import { DoorbellPage } from "@/pages/Doorbell";
import { LoginPage } from "@/pages/Login";
import { SettingsPage } from "@/pages/Settings";
import { VacuumPage } from "@/pages/Vacuum";
import { useAuthStore } from "@/stores/auth";

function PrivateRoute({ children }: { children: React.ReactNode }) {
	const { isAuthenticated, isLoading } = useAuthStore();

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<Loader2 className="w-8 h-8 animate-spin text-primary-600" />
			</div>
		);
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" replace />;
	}

	return <>{children}</>;
}

function App() {
	const { checkAuth, isAuthenticated } = useAuthStore();

	useEffect(() => {
		checkAuth();
	}, [checkAuth]);

	return (
		<Routes>
			<Route
				path="/login"
				element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
			/>
			<Route
				element={
					<PrivateRoute>
						<Layout />
					</PrivateRoute>
				}
			>
				<Route index element={<DashboardPage />} />
				<Route path="vacuum" element={<VacuumPage />} />
				<Route path="doorbell" element={<DoorbellPage />} />
				<Route path="settings" element={<SettingsPage />} />
			</Route>
			<Route path="*" element={<Navigate to="/" replace />} />
		</Routes>
	);
}

export default App;
