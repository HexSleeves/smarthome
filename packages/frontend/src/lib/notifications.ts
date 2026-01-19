// Browser Push Notification Service

export type NotificationPermissionState = "granted" | "denied" | "default";

export function isNotificationSupported(): boolean {
	return "Notification" in window;
}

export function getNotificationPermission(): NotificationPermissionState {
	if (!isNotificationSupported()) return "denied";
	return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
	if (!isNotificationSupported()) return "denied";
	
	try {
		const permission = await Notification.requestPermission();
		return permission;
	} catch {
		return "denied";
	}
}

export function showNotification(
	title: string,
	options?: NotificationOptions & { onClick?: () => void }
): Notification | null {
	if (!isNotificationSupported() || Notification.permission !== "granted") {
		return null;
	}

	const notification = new Notification(title, {
		icon: "/favicon.ico",
		badge: "/favicon.ico",
		...options,
	});

	if (options?.onClick) {
		notification.onclick = () => {
			window.focus();
			options.onClick?.();
			notification.close();
		};
	}

	// Auto-close after 10 seconds
	setTimeout(() => notification.close(), 10000);

	return notification;
}

// Doorbell-specific notifications
export function notifyDoorbell(deviceName: string) {
	showNotification("🔔 Doorbell", {
		body: `Someone is at ${deviceName}`,
		tag: "doorbell", // Replaces existing doorbell notifications
		requireInteraction: true,
		onClick: () => {
			window.location.href = "/doorbell";
		},
	});
}

export function notifyMotion(deviceName: string) {
	showNotification("🚶 Motion Detected", {
		body: `Motion detected at ${deviceName}`,
		tag: "motion",
		onClick: () => {
			window.location.href = "/doorbell";
		},
	});
}

export function notifyVacuumStatus(deviceName: string, status: string) {
	const statusMessages: Record<string, string> = {
		cleaning: "Started cleaning",
		returning: "Returning to dock",
		charging: "Charging",
		idle: "Finished cleaning",
		error: "Error occurred",
	};

	const message = statusMessages[status] || `Status: ${status}`;

	showNotification(`🧹 ${deviceName}`, {
		body: message,
		tag: "vacuum",
	});
}
