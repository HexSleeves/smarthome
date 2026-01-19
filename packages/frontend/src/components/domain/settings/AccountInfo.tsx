import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth";

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
					<Label className="text-sm text-muted-foreground">Email</Label>
					<p className="font-medium">{user?.email}</p>
				</div>
				<div>
					<Label className="text-sm text-muted-foreground">Name</Label>
					<p className="font-medium">{user?.name || "Not set"}</p>
				</div>
				<div>
					<Label className="text-sm text-muted-foreground">Role</Label>
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
