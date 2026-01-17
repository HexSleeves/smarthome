import { useQuery } from "@tanstack/react-query";
import { Wifi, Bell, Battery, Clock, Activity } from "lucide-react";
import { deviceApi, roborockApi, ringApi } from "@/lib/api";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { wsClient } from "@/lib/websocket";

export function DashboardPage() {
	const [wsConnected, setWsConnected] = useState(false);
	const [realtimeEvents, setRealtimeEvents] = useState<any[]>([]);

	// Fetch device data
	const { data: devicesData } = useQuery({
		queryKey: ["devices"],
		queryFn: deviceApi.list,
	});

	const { data: roborockStatus } = useQuery({
		queryKey: ["roborock-status"],
		queryFn: roborockApi.status,
	});

	const { data: ringStatus } = useQuery({
		queryKey: ["ring-status"],
		queryFn: ringApi.status,
	});

	const { data: eventsData } = useQuery({
		queryKey: ["recent-events"],
		queryFn: () => deviceApi.recentEvents(10),
	});

	// WebSocket connection
	useEffect(() => {
		wsClient.connect();

		const unsubConnected = wsClient.on("connected", () => setWsConnected(true));
		const unsubDisconnected = wsClient.on("disconnected", () =>
			setWsConnected(false),
		);

		const unsubRoborock = wsClient.on("roborock:status", (data) => {
			setRealtimeEvents((prev) =>
				[
					{ type: "vacuum_status", ...data, timestamp: new Date() },
					...prev,
				].slice(0, 5),
			);
		});

		const unsubRingMotion = wsClient.on("ring:motion", (data) => {
			setRealtimeEvents((prev) =>
				[{ type: "motion", ...data, timestamp: new Date() }, ...prev].slice(
					0,
					5,
				),
			);
		});

		const unsubRingDing = wsClient.on("ring:ding", (data) => {
			setRealtimeEvents((prev) =>
				[{ type: "doorbell", ...data, timestamp: new Date() }, ...prev].slice(
					0,
					5,
				),
			);
		});

		return () => {
			unsubConnected();
			unsubDisconnected();
			unsubRoborock();
			unsubRingMotion();
			unsubRingDing();
		};
	}, []);

	const devices = devicesData?.devices || [];
	const vacuums = devices.filter((d) => d.type === "roborock");
	const doorbells = devices.filter((d) => d.type === "ring");

	return (
		<div className="space-y-6">
			{/* Status Bar */}
			<div className="flex items-center gap-4 text-sm">
				<div
					className={`flex items-center gap-1.5 ${wsConnected ? "text-green-600" : "text-gray-400"}`}
				>
					<div
						className={`w-2 h-2 rounded-full ${wsConnected ? "bg-green-500" : "bg-gray-400"}`}
					/>
					{wsConnected ? "Live" : "Connecting..."}
				</div>
			</div>

			{/* Quick Stats */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<StatCard
					title="Vacuum"
					icon={Wifi}
					value={roborockStatus?.connected ? "Connected" : "Disconnected"}
					status={roborockStatus?.connected ? "success" : "warning"}
					link="/vacuum"
				/>
				<StatCard
					title="Doorbell"
					icon={Bell}
					value={ringStatus?.connected ? "Connected" : "Disconnected"}
					status={ringStatus?.connected ? "success" : "warning"}
					link="/doorbell"
				/>
				<StatCard
					title="Total Devices"
					icon={Activity}
					value={String(devices.length)}
					status="neutral"
				/>
				<StatCard
					title="Recent Events"
					icon={Clock}
					value={String(eventsData?.events?.length || 0)}
					status="neutral"
				/>
			</div>

			{/* Device Cards */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Vacuum Section */}
				<div className="card p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-semibold flex items-center gap-2">
							<Wifi className="w-5 h-5 text-primary-600" />
							Robot Vacuum
						</h2>
						<Link
							to="/vacuum"
							className="text-sm text-primary-600 hover:text-primary-700"
						>
							View All →
						</Link>
					</div>

					{!roborockStatus?.connected && !roborockStatus?.hasCredentials ? (
						<div className="text-center py-8 text-gray-500">
							<Wifi className="w-12 h-12 mx-auto mb-3 opacity-50" />
							<p>No vacuum connected</p>
							<Link
								to="/settings"
								className="text-primary-600 text-sm hover:underline"
							>
								Connect your Roborock
							</Link>
						</div>
					) : vacuums.length > 0 ? (
						<div className="space-y-3">
							{vacuums.map((vacuum) => (
								<VacuumCard key={vacuum.id} vacuum={vacuum} />
							))}
						</div>
					) : (
						<div className="text-center py-8 text-gray-500">
							<p>Connecting to vacuum...</p>
						</div>
					)}
				</div>

				{/* Doorbell Section */}
				<div className="card p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-semibold flex items-center gap-2">
							<Bell className="w-5 h-5 text-primary-600" />
							Ring Doorbell
						</h2>
						<Link
							to="/doorbell"
							className="text-sm text-primary-600 hover:text-primary-700"
						>
							View All →
						</Link>
					</div>

					{!ringStatus?.connected && !ringStatus?.hasCredentials ? (
						<div className="text-center py-8 text-gray-500">
							<Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
							<p>No doorbell connected</p>
							<Link
								to="/settings"
								className="text-primary-600 text-sm hover:underline"
							>
								Connect your Ring
							</Link>
						</div>
					) : doorbells.length > 0 ? (
						<div className="space-y-3">
							{doorbells.map((doorbell) => (
								<DoorbellCard key={doorbell.id} doorbell={doorbell} />
							))}
						</div>
					) : (
						<div className="text-center py-8 text-gray-500">
							<p>Connecting to doorbell...</p>
						</div>
					)}
				</div>
			</div>

			{/* Real-time Events */}
			{realtimeEvents.length > 0 && (
				<div className="card p-6">
					<h2 className="text-lg font-semibold mb-4">Live Events</h2>
					<div className="space-y-2">
						{realtimeEvents.map((event, i) => (
							<div
								key={i}
								className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
							>
								<div
									className={`w-2 h-2 rounded-full ${
										event.type === "doorbell"
											? "bg-yellow-500"
											: event.type === "motion"
												? "bg-blue-500"
												: "bg-green-500"
									}`}
								/>
								<span className="flex-1 text-sm">
									{event.type === "doorbell"
										? "🔔 Doorbell pressed"
										: event.type === "motion"
											? "🚶 Motion detected"
											: `🧹 Vacuum: ${event.state?.status || "status update"}`}
								</span>
								<span className="text-xs text-gray-500">
									{new Date(event.timestamp).toLocaleTimeString()}
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Recent Events */}
			{eventsData?.events && eventsData.events.length > 0 && (
				<div className="card p-6">
					<h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
					<div className="space-y-2">
						{eventsData.events.map((event: any) => (
							<div
								key={event.id}
								className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
							>
								<Clock className="w-4 h-4 text-gray-400" />
								<span className="flex-1 text-sm">{event.type}</span>
								<span className="text-xs text-gray-500">
									{new Date(event.created_at).toLocaleString()}
								</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function StatCard({
	title,
	icon: Icon,
	value,
	status,
	link,
}: {
	title: string;
	icon: any;
	value: string;
	status: "success" | "warning" | "error" | "neutral";
	link?: string;
}) {
	const statusColors = {
		success: "text-green-600 bg-green-50 dark:bg-green-900/30",
		warning: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30",
		error: "text-red-600 bg-red-50 dark:bg-red-900/30",
		neutral: "text-gray-600 bg-gray-50 dark:bg-gray-700/50",
	};

	const content = (
		<div className="card p-4 hover:shadow-md transition-shadow">
			<div className="flex items-center gap-3">
				<div className={`p-2 rounded-lg ${statusColors[status]}`}>
					<Icon className="w-5 h-5" />
				</div>
				<div>
					<p className="text-sm text-gray-500">{title}</p>
					<p className="font-semibold">{value}</p>
				</div>
			</div>
		</div>
	);

	if (link) {
		return <Link to={link}>{content}</Link>;
	}
	return content;
}

function VacuumCard({ vacuum }: { vacuum: any }) {
	const state = vacuum.liveState;

	const statusColors: Record<string, string> = {
		idle: "bg-gray-500",
		cleaning: "bg-green-500",
		returning: "bg-blue-500",
		charging: "bg-yellow-500",
		paused: "bg-orange-500",
		error: "bg-red-500",
		offline: "bg-gray-400",
	};

	return (
		<div className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
			<div
				className={`w-3 h-3 rounded-full ${statusColors[state?.status || "offline"]}`}
			/>
			<div className="flex-1">
				<p className="font-medium">{vacuum.name}</p>
				<p className="text-sm text-gray-500 capitalize">
					{state?.status || "Offline"}
				</p>
			</div>
			{state?.battery !== undefined && (
				<div className="flex items-center gap-1 text-sm">
					<Battery className="w-4 h-4" />
					{state.battery}%
				</div>
			)}
		</div>
	);
}

function DoorbellCard({ doorbell }: { doorbell: any }) {
	const state = doorbell.liveState;

	return (
		<div className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
			<div
				className={`w-3 h-3 rounded-full ${state?.status === "online" ? "bg-green-500" : "bg-gray-400"}`}
			/>
			<div className="flex-1">
				<p className="font-medium">{doorbell.name}</p>
				<p className="text-sm text-gray-500 capitalize">
					{state?.type || "Doorbell"}
				</p>
			</div>
			{state?.battery !== undefined && state?.battery !== null && (
				<div className="flex items-center gap-1 text-sm">
					<Battery className="w-4 h-4" />
					{state.battery}%
				</div>
			)}
		</div>
	);
}
