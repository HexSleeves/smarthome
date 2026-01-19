import type { RingDeviceState } from "@smarthome/shared";
import { Battery, Bell, Camera } from "lucide-react";
import { useState } from "react";
import { DoorbellControls } from "./DoorbellControls";
import { DoorbellHistory } from "./DoorbellHistory";
import { DoorbellLiveStream } from "./DoorbellLiveStream";
import { DoorbellNotifications } from "./DoorbellNotifications";
import { DoorbellSnapshot } from "./DoorbellSnapshot";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

type DoorbellDeviceProps = {
	device: RingDeviceState;
	isAdmin: boolean;
};

export function DoorbellDevice({ device, isAdmin }: DoorbellDeviceProps) {
	const [viewMode, setViewMode] = useState<"live" | "snapshot">("live");

	return (
		<Card>
			<CardHeader className="pb-4">
				<div className="flex items-center gap-4">
					<div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
						{device.type === "doorbell" ? (
							<Bell className="w-8 h-8 text-primary" />
						) : (
							<Camera className="w-8 h-8 text-primary" />
						)}
					</div>
					<div className="flex-1">
						<h2 className="text-xl font-semibold">{device.name}</h2>
						<p className="text-sm text-muted-foreground capitalize">{device.type}</p>
					</div>
					<div className="text-right">
						<Badge variant={device.status === "online" ? "success" : "secondary"} className="gap-1.5">
							<span className={`w-2 h-2 rounded-full ${device.status === "online" ? "bg-green-500" : "bg-gray-400"}`} />
							{device.status}
						</Badge>
						{device.battery !== null && (
							<div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
								<Battery className="w-4 h-4" />
								{device.battery}%
							</div>
						)}
					</div>
				</div>
			</CardHeader>

			{/* Live Notifications */}
			<DoorbellNotifications deviceId={device.id} />

			{/* View Mode Toggle */}
			<Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "live" | "snapshot")} className="px-6">
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="live">Live Stream</TabsTrigger>
					<TabsTrigger value="snapshot">Snapshot</TabsTrigger>
				</TabsList>
				<TabsContent value="live" className="mt-4">
					<DoorbellLiveStream deviceId={device.id} />
				</TabsContent>
				<TabsContent value="snapshot" className="mt-4">
					<DoorbellSnapshot deviceId={device.id} />
				</TabsContent>
			</Tabs>

			<Separator className="my-6" />

			{/* Controls & History */}
			<CardContent className="space-y-6 pt-0">
				<DoorbellControls device={device} isAdmin={isAdmin} />
				<DoorbellHistory deviceId={device.id} />
			</CardContent>
		</Card>
	);
}
