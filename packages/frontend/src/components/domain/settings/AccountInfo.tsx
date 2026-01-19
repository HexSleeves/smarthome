import { Shield } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function AccountInfo() {
	const { user } = useAuthStore();

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Shield className="w-5 h-5" />
					Account
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div>
					<label className="text-sm text-muted-foreground">Email</label>
					<p className="font-medium">{user?.email}</p>
				</div>
				<div>
					<label className="text-sm text-muted-foreground">Name</label>
					<p className="font-medium">{user?.name || "Not set"}</p>
				</div>
				<div>
					<label className="text-sm text-muted-foreground">Role</label>
					<div className="mt-1">
						<Badge
							variant={user?.role === "admin" ? "default" : "secondary"}
							className="capitalize"
						>
							{user?.role}
						</Badge>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
