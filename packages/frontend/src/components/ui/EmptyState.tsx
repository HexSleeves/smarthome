import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./button";
import { Card, CardContent } from "./card";

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
		<Card>
			<CardContent className="py-8 text-center">
				<Icon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
				<h2 className="text-xl font-semibold mb-2">{title}</h2>
				{description && (
					<p className="text-muted-foreground mb-4">{description}</p>
				)}
				{actionLabel && actionLink && (
					<Button asChild>
						<Link to={actionLink}>{actionLabel}</Link>
					</Button>
				)}
			</CardContent>
		</Card>
	);
}
