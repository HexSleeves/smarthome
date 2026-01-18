import { Shield } from "lucide-react";
import { useAuthStore } from "@/stores/auth";

export function AccountInfo() {
	const { user } = useAuthStore();

	return (
		<div className="card p-6">
			<h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
				<Shield className="w-5 h-5" />
				Account
			</h2>
			<div className="space-y-3">
				<div>
					<label className="text-sm text-gray-500">Email</label>
					<p className="font-medium">{user?.email}</p>
				</div>
				<div>
					<label className="text-sm text-gray-500">Name</label>
					<p className="font-medium">{user?.name || "Not set"}</p>
				</div>
				<div>
					<label className="text-sm text-gray-500">Role</label>
					<p className="font-medium capitalize">{user?.role}</p>
				</div>
			</div>
		</div>
	);
}
