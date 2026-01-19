import { Bell, BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	getNotificationPermission,
	isNotificationSupported,
	requestNotificationPermission,
	showNotification,
} from "@/lib/notifications";
import { useNotificationStore } from "@/stores/notifications";

function NotificationToggle({
	label,
	description,
	checked,
	onChange,
	disabled,
}: {
	label: string;
	description: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
}) {
	return (
		<div className="flex items-center justify-between py-3">
			<div className="space-y-0.5">
				<Label className={disabled ? "text-muted-foreground" : ""}>
					{label}
				</Label>
				<p className="text-sm text-muted-foreground">{description}</p>
			</div>
			<Button
				variant={checked ? "default" : "outline"}
				size="sm"
				onClick={() => onChange(!checked)}
				disabled={disabled}
			>
				{checked ? "On" : "Off"}
			</Button>
		</div>
	);
}

export function NotificationSettings() {
	const [permission, setPermission] = useState(getNotificationPermission());
	const [requesting, setRequesting] = useState(false);
	const supported = isNotificationSupported();

	const {
		enabled,
		doorbellAlerts,
		motionAlerts,
		vacuumAlerts,
		setEnabled,
		setDoorbellAlerts,
		setMotionAlerts,
		setVacuumAlerts,
	} = useNotificationStore();

	useEffect(() => {
		// Update permission state when it might change
		const checkPermission = () => {
			setPermission(getNotificationPermission());
		};

		// Check on visibility change (user might have changed settings)
		document.addEventListener("visibilitychange", checkPermission);
		return () =>
			document.removeEventListener("visibilitychange", checkPermission);
	}, []);

	const handleEnableNotifications = async () => {
		setRequesting(true);
		try {
			const result = await requestNotificationPermission();
			setPermission(result);
			if (result === "granted") {
				setEnabled(true);
				// Show a test notification
				showNotification("Notifications Enabled", {
					body: "You'll now receive alerts for doorbell and motion events.",
				});
			}
		} finally {
			setRequesting(false);
		}
	};

	if (!supported) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<BellOff className="w-5 h-5" />
						Notifications
					</CardTitle>
				</CardHeader>
				<CardContent>
					<Alert>
						<AlertDescription>
							Your browser doesn't support notifications.
						</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
				<div>
					<CardTitle className="flex items-center gap-2">
						<BellRing className="w-5 h-5" />
						Notifications
					</CardTitle>
					<CardDescription>
						Get alerts for doorbell and motion events
					</CardDescription>
				</div>
				{permission === "granted" && (
					<Badge variant={enabled ? "success" : "secondary"}>
						{enabled ? "Enabled" : "Disabled"}
					</Badge>
				)}
			</CardHeader>
			<CardContent>
				{permission === "denied" ? (
					<Alert variant="warning">
						<Bell className="h-4 w-4" />
						<AlertDescription>
							Notifications are blocked. Please enable them in your browser
							settings.
						</AlertDescription>
					</Alert>
				) : permission === "default" ? (
					<div className="space-y-4">
						<p className="text-muted-foreground">
							Enable notifications to get alerts when someone rings your
							doorbell or motion is detected.
						</p>
						<Button onClick={handleEnableNotifications} disabled={requesting}>
							<Bell className="w-4 h-4 mr-2" />
							{requesting ? "Requesting..." : "Enable Notifications"}
						</Button>
					</div>
				) : (
					<div className="space-y-2 divide-y">
						<NotificationToggle
							label="Enable Notifications"
							description="Master toggle for all notifications"
							checked={enabled}
							onChange={setEnabled}
						/>
						<NotificationToggle
							label="Doorbell Alerts"
							description="When someone rings the doorbell"
							checked={doorbellAlerts}
							onChange={setDoorbellAlerts}
							disabled={!enabled}
						/>
						<NotificationToggle
							label="Motion Alerts"
							description="When motion is detected"
							checked={motionAlerts}
							onChange={setMotionAlerts}
							disabled={!enabled}
						/>
						<NotificationToggle
							label="Vacuum Alerts"
							description="When vacuum status changes"
							checked={vacuumAlerts}
							onChange={setVacuumAlerts}
							disabled={!enabled}
						/>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
