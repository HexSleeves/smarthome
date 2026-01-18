import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

type EmptyStateProps = {
	icon: LucideIcon;
	title: string;
	description?: string;
	actionLabel?: string;
	actionLink?: string;
};

export function EmptyState({
	icon: Icon,
	title,
	description,
	actionLabel,
	actionLink,
}: EmptyStateProps) {
	return (
		<div className="card p-8 text-center">
			<Icon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
			<h2 className="text-xl font-semibold mb-2">{title}</h2>
			{description && <p className="text-gray-500 mb-4">{description}</p>}
			{actionLabel && actionLink && (
				<Link to={actionLink} className="btn btn-primary">
					{actionLabel}
				</Link>
			)}
		</div>
	);
}
