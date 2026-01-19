import { Loader2 } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout/AppShell";
import { useAuthStore } from "@/stores/auth";

// Lazy load pages for code splitting
const LoginPage = lazy(() => import("@/pages/Login").then(m => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import("@/pages/Dashboard").then(m => ({ default: m.DashboardPage })));
const VacuumPage = lazy(() => import("@/pages/Vacuum").then(m => ({ default: m.VacuumPage })));
const DoorbellPage = lazy(() => import("@/pages/Doorbell").then(m => ({ default: m.DoorbellPage })));
const SettingsPage = lazy(() => import("@/pages/Settings").then(m => ({ default: m.SettingsPage })));

function PageLoader() {
	return (
		<div className="flex items-center justify-center h-64">
			<Loader2 className="w-8 h-8 animate-spin text-primary" />
		</div>
	);
}

function FullPageLoader() {
	return (
		<div className="min-h-screen flex items-center justify-center">
			<Loader2 className="w-8 h-8 animate-spin text-primary" />
		</div>
	);
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
	const { isAuthenticated, isLoading } = useAuthStore();

	if (isLoading) {
		return <FullPageLoader />;
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
		<Suspense fallback={<FullPageLoader />}>
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
					<Route index element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
					<Route path="vacuum" element={<Suspense fallback={<PageLoader />}><VacuumPage /></Suspense>} />
					<Route path="doorbell" element={<Suspense fallback={<PageLoader />}><DoorbellPage /></Suspense>} />
					<Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
				</Route>
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</Suspense>
	);
}

export default App;
