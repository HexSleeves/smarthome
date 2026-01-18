import { clsx } from "clsx";

type StatusType = "success" | "warning" | "error" | "neutral" | "info";

type StatusBadgeProps = {
	status: StatusType;
	label: string;
	showDot?: boolean;
};

const statusStyles: Record<StatusType, { dot: string; text: string }> = {
	success: { dot: "bg-green-500", text: "text-green-600" },
	warning: { dot: "bg-yellow-500", text: "text-yellow-600" },
	error: { dot: "bg-red-500", text: "text-red-600" },
	neutral: { dot: "bg-gray-400", text: "text-gray-600" },
	info: { dot: "bg-blue-500", text: "text-blue-600" },
};

export function StatusBadge({
	status,
	label,
	showDot = true,
}: StatusBadgeProps) {
	const styles = statusStyles[status];

	return (
		<div className={clsx("flex items-center gap-1.5", styles.text)}>
			{showDot && <div className={clsx("w-2 h-2 rounded-full", styles.dot)} />}
			<span>{label}</span>
		</div>
	);
}

export function ConnectionStatus({ connected }: { connected: boolean }) {
	return (
		<StatusBadge
			status={connected ? "success" : "neutral"}
			label={connected ? "Live" : "Connecting..."}
		/>
	);
}
