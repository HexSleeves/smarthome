import {
	AccountInfo,
	NotificationSettings,
	RingSettings,
	RoborockSettings,
} from "@/components/domain/settings";

export function SettingsPage() {
	return (
		<div className="max-w-2xl space-y-6">
			<AccountInfo />
			<NotificationSettings />
			<RoborockSettings />
			<RingSettings />
		</div>
	);
}
