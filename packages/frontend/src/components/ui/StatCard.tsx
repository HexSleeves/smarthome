import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

type StatusType = "success" | "warning" | "error" | "neutral";

type StatCardProps = {
	title: string;
	icon: LucideIcon;
	value: string;
	status: StatusType;
	link?: string;
};

const statusColors: Record<StatusType, string> = {
	success: "text-green-600 bg-green-50 dark:bg-green-900/30",
	warning: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30",
	error: "text-red-600 bg-red-50 dark:bg-red-900/30",
	neutral: "text-gray-600 bg-gray-50 dark:bg-gray-700/50",
};

export function StatCard({
	title,
	icon: Icon,
	value,
	status,
	link,
}: StatCardProps) {
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
