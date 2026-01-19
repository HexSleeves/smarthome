import { cn } from "@/lib/utils";
import { Badge } from "./badge";

type StatusType = "success" | "warning" | "error" | "neutral" | "info";

type StatusBadgeProps = {
	status: StatusType;
	label: string;
	showDot?: boolean;
};

const statusVariants: Record<
	StatusType,
	"success" | "warning" | "destructive" | "secondary" | "info"
> = {
	success: "success",
	warning: "warning",
	error: "destructive",
	neutral: "secondary",
	info: "info",
};

const dotColors: Record<StatusType, string> = {
	success: "bg-green-500",
	warning: "bg-yellow-500",
	error: "bg-red-500",
	neutral: "bg-gray-400",
	info: "bg-blue-500",
};

export function StatusBadge({
	status,
	label,
	showDot = true,
}: StatusBadgeProps) {
	return (
		<Badge variant={statusVariants[status]} className="gap-1.5">
			{showDot && (
				<span className={cn("w-2 h-2 rounded-full", dotColors[status])} />
			)}
			{label}
		</Badge>
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
