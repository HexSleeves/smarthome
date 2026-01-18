import { clsx } from "clsx";
import { Bell, Home, LogOut, Menu, Settings, Wifi, X } from "lucide-react";
import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";

const navigation = [
	{ name: "Dashboard", href: "/", icon: Home },
	{ name: "Vacuum", href: "/vacuum", icon: Wifi },
	{ name: "Doorbell", href: "/doorbell", icon: Bell },
	{ name: "Settings", href: "/settings", icon: Settings },
];

export function Layout() {
	const location = useLocation();
	const { user, logout } = useAuthStore();
	const [sidebarOpen, setSidebarOpen] = useState(false);

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
			{/* Mobile sidebar backdrop */}
			{sidebarOpen && (
				<div
					className="fixed inset-0 z-40 bg-black/50 lg:hidden"
					onClick={() => setSidebarOpen(false)}
				/>
			)}

			{/* Sidebar */}
			<aside
				className={clsx(
					"fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform lg:transform-none lg:translate-x-0",
					sidebarOpen ? "translate-x-0" : "-translate-x-full",
				)}
			>
				<div className="flex flex-col h-full">
					{/* Logo */}
					<div className="flex items-center gap-2 px-6 h-16 border-b border-gray-200 dark:border-gray-700">
						<Home className="w-8 h-8 text-primary-600" />
						<span className="text-xl font-bold">Smart Home</span>
						<button
							type="button"
							className="ml-auto lg:hidden"
							onClick={() => setSidebarOpen(false)}
						>
							<X className="w-6 h-6" />
						</button>
					</div>

					{/* Navigation */}
					<nav className="flex-1 px-3 py-4 space-y-1">
						{navigation.map((item) => {
							const isActive = location.pathname === item.href;
							return (
								<Link
									key={item.name}
									to={item.href}
									onClick={() => setSidebarOpen(false)}
									className={clsx(
										"flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
										isActive
											? "bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
											: "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700",
									)}
								>
									<item.icon className="w-5 h-5" />
									{item.name}
								</Link>
							);
						})}
					</nav>

					{/* User */}
					<div className="p-4 border-t border-gray-200 dark:border-gray-700">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
								<span className="text-primary-700 dark:text-primary-300 font-medium">
									{user?.email?.[0]?.toUpperCase() || "?"}
								</span>
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium truncate">
									{user?.name || user?.email}
								</p>
								<p className="text-xs text-gray-500 capitalize">{user?.role}</p>
							</div>
							<button
								type="button"
								onClick={logout}
								className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
								title="Logout"
							>
								<LogOut className="w-5 h-5" />
							</button>
						</div>
					</div>
				</div>
			</aside>

			{/* Main content */}
			<div className="lg:pl-64">
				{/* Top bar */}
				<header className="sticky top-0 z-30 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 lg:px-6">
					<button
						type="button"
						className="lg:hidden p-2 -ml-2 text-gray-500"
						onClick={() => setSidebarOpen(true)}
					>
						<Menu className="w-6 h-6" />
					</button>
					<h1 className="text-lg font-semibold ml-2 lg:ml-0">
						{navigation.find((n) => n.href === location.pathname)?.name ||
							"Smart Home"}
					</h1>
				</header>

				{/* Page content */}
				<main className="p-4 lg:p-6">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
