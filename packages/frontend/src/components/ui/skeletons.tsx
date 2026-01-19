import { Card, CardContent, CardHeader } from "./card";
import { Skeleton } from "./skeleton";

export function StatCardSkeleton() {
	return (
		<Card>
			<CardContent className="p-4">
				<div className="flex items-center gap-3">
					<Skeleton className="h-9 w-9 rounded-lg" />
					<div className="space-y-2">
						<Skeleton className="h-3 w-16" />
						<Skeleton className="h-4 w-24" />
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export function DeviceCardSkeleton() {
	return (
		<div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
			<Skeleton className="w-3 h-3 rounded-full" />
			<div className="flex-1 space-y-2">
				<Skeleton className="h-4 w-32" />
				<Skeleton className="h-5 w-16 rounded-md" />
			</div>
			<Skeleton className="h-4 w-12" />
		</div>
	);
}

export function DeviceSectionSkeleton() {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
				<div className="flex items-center gap-2">
					<Skeleton className="h-5 w-5" />
					<Skeleton className="h-5 w-28" />
				</div>
				<Skeleton className="h-4 w-16" />
			</CardHeader>
			<CardContent className="space-y-3">
				<DeviceCardSkeleton />
				<DeviceCardSkeleton />
			</CardContent>
		</Card>
	);
}

export function SettingsCardSkeleton() {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
				<div className="flex items-center gap-2">
					<Skeleton className="h-5 w-5" />
					<Skeleton className="h-5 w-24" />
				</div>
				<Skeleton className="h-5 w-24 rounded-full" />
			</CardHeader>
			<CardContent className="space-y-4">
				<Skeleton className="h-4 w-full max-w-xs" />
				<div className="space-y-2">
					<Skeleton className="h-4 w-12" />
					<Skeleton className="h-9 w-full" />
				</div>
				<div className="space-y-2">
					<Skeleton className="h-4 w-16" />
					<Skeleton className="h-9 w-full" />
				</div>
				<Skeleton className="h-9 w-32" />
			</CardContent>
		</Card>
	);
}

export function VacuumDeviceSkeleton() {
	return (
		<Card>
			<CardHeader className="pb-4">
				<div className="flex items-center gap-4">
					<Skeleton className="w-16 h-16 rounded-2xl" />
					<div className="flex-1 space-y-2">
						<Skeleton className="h-6 w-40" />
						<Skeleton className="h-4 w-24" />
					</div>
					<div className="text-right space-y-2">
						<Skeleton className="h-5 w-20 rounded-full" />
						<Skeleton className="h-4 w-12 ml-auto" />
					</div>
				</div>
			</CardHeader>
			<div className="grid grid-cols-4 gap-4 p-6 bg-muted/50">
				<div className="space-y-2">
					<Skeleton className="h-3 w-16" />
					<Skeleton className="h-5 w-12" />
				</div>
				<div className="space-y-2">
					<Skeleton className="h-3 w-16" />
					<Skeleton className="h-5 w-12" />
				</div>
				<div className="space-y-2">
					<Skeleton className="h-3 w-16" />
					<Skeleton className="h-5 w-12" />
				</div>
				<div className="space-y-2">
					<Skeleton className="h-3 w-16" />
					<Skeleton className="h-5 w-12" />
				</div>
			</div>
			<CardContent className="space-y-6 pt-6">
				<div className="space-y-3">
					<Skeleton className="h-4 w-16" />
					<div className="flex gap-3">
						<Skeleton className="h-9 w-20" />
						<Skeleton className="h-9 w-20" />
						<Skeleton className="h-9 w-20" />
						<Skeleton className="h-9 w-20" />
						<Skeleton className="h-9 w-20" />
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export function DoorbellDeviceSkeleton() {
	return (
		<Card>
			<CardHeader className="pb-4">
				<div className="flex items-center gap-4">
					<Skeleton className="w-16 h-16 rounded-2xl" />
					<div className="flex-1 space-y-2">
						<Skeleton className="h-6 w-40" />
						<Skeleton className="h-4 w-20" />
					</div>
					<div className="text-right space-y-2">
						<Skeleton className="h-5 w-16 rounded-full" />
						<Skeleton className="h-4 w-12 ml-auto" />
					</div>
				</div>
			</CardHeader>
			<div className="px-6">
				<Skeleton className="h-9 w-full rounded-lg" />
			</div>
			<div className="p-6">
				<Skeleton className="aspect-video w-full rounded-lg" />
			</div>
		</Card>
	);
}
