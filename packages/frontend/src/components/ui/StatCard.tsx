import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "./card";
import { cn } from "@/lib/utils";

type StatusType = "success" | "warning" | "error" | "neutral";

type StatCardProps = {
	title: string;
	icon: LucideIcon;
	value: string;
	status: StatusType;
	link?: string;
};

const statusColors: Record<StatusType, string> = {
	success: "text-green-600 bg-green-100 dark:bg-green-900/30",
	warning: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30",
	error: "text-red-600 bg-red-100 dark:bg-red-900/30",
	neutral: "text-muted-foreground bg-muted",
};

export function StatCard({
	title,
	icon: Icon,
	value,
	status,
	link,
}: StatCardProps) {
	const content = (
		<Card className="hover:shadow-md transition-shadow">
			<CardContent className="p-4">
				<div className="flex items-center gap-3">
					<div className={cn("p-2 rounded-lg", statusColors[status])}>
						<Icon className="w-5 h-5" />
					</div>
					<div>
						<p className="text-sm text-muted-foreground">{title}</p>
						<p className="font-semibold">{value}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);

	if (link) {
		return <Link to={link}>{content}</Link>;
	}
	return content;
}
