import { Bell, Home, LogOut, Menu, Settings, Wifi } from "lucide-react";
import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";

const navigation = [
	{ name: "Dashboard", href: "/", icon: Home },
	{ name: "Vacuum", href: "/vacuum", icon: Wifi },
	{ name: "Doorbell", href: "/doorbell", icon: Bell },
	{ name: "Settings", href: "/settings", icon: Settings },
];

function NavLink({
	item,
	onClick,
}: {
	item: (typeof navigation)[0];
	onClick?: () => void;
}) {
	const location = useLocation();
	const isActive = location.pathname === item.href;

	return (
		<Link
			to={item.href}
			onClick={onClick}
			className={cn(
				"flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
				isActive
					? "bg-primary text-primary-foreground"
					: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
			)}
		>
			<item.icon className="w-5 h-5" />
			{item.name}
		</Link>
	);
}

export function Layout() {
	const location = useLocation();
	const { user, logout } = useAuthStore();
	const [sidebarOpen, setSidebarOpen] = useState(false);

	return (
		<TooltipProvider>
			<div className="min-h-screen bg-background">
				{/* Desktop Sidebar */}
				<aside className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r bg-card lg:block">
					<div className="flex flex-col h-full">
						{/* Logo */}
						<div className="flex items-center gap-2 px-6 h-16 border-b">
							<Home className="w-8 h-8 text-primary" />
							<span className="text-xl font-bold">Smart Home</span>
						</div>

						{/* Navigation */}
						<nav className="flex-1 px-3 py-4 space-y-1">
							{navigation.map((item) => (
								<NavLink key={item.name} item={item} />
							))}
						</nav>

						{/* User */}
						<div className="p-4 border-t">
							<div className="flex items-center gap-3">
								<Avatar>
									<AvatarFallback className="bg-primary text-primary-foreground">
										{user?.email?.[0]?.toUpperCase() || "?"}
									</AvatarFallback>
								</Avatar>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium truncate">
										{user?.name || user?.email}
									</p>
									<p className="text-xs text-muted-foreground capitalize">
										{user?.role}
									</p>
								</div>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button variant="ghost" size="icon" onClick={logout}>
											<LogOut className="w-5 h-5" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Logout</TooltipContent>
								</Tooltip>
							</div>
						</div>
					</div>
				</aside>

				{/* Mobile Sidebar */}
				<Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
					<SheetContent side="left" className="w-64 p-0">
						<SheetHeader className="px-6 h-16 border-b flex-row items-center gap-2">
							<Home className="w-8 h-8 text-primary" />
							<SheetTitle>Smart Home</SheetTitle>
						</SheetHeader>
						<nav className="flex-1 px-3 py-4 space-y-1">
							{navigation.map((item) => (
								<NavLink
									key={item.name}
									item={item}
									onClick={() => setSidebarOpen(false)}
								/>
							))}
						</nav>
						<Separator />
						<div className="p-4">
							<div className="flex items-center gap-3">
								<Avatar>
									<AvatarFallback className="bg-primary text-primary-foreground">
										{user?.email?.[0]?.toUpperCase() || "?"}
									</AvatarFallback>
								</Avatar>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium truncate">
										{user?.name || user?.email}
									</p>
									<p className="text-xs text-muted-foreground capitalize">
										{user?.role}
									</p>
								</div>
								<Button variant="ghost" size="icon" onClick={logout}>
									<LogOut className="w-5 h-5" />
								</Button>
							</div>
						</div>
					</SheetContent>
				</Sheet>

				{/* Main content */}
				<div className="lg:pl-64">
					{/* Top bar */}
					<header className="sticky top-0 z-30 h-16 border-b bg-card flex items-center px-4 lg:px-6">
						<Button
							variant="ghost"
							size="icon"
							className="lg:hidden -ml-2"
							onClick={() => setSidebarOpen(true)}
						>
							<Menu className="w-6 h-6" />
						</Button>
						<h1 className="text-lg font-semibold ml-2 lg:ml-0 flex-1">
							{navigation.find((n) => n.href === location.pathname)?.name ||
								"Smart Home"}
						</h1>
						<ThemeToggle />
					</header>

					{/* Page content */}
					<main className="p-4 lg:p-6">
						<Outlet />
					</main>
				</div>
			</div>
		</TooltipProvider>
	);
}
