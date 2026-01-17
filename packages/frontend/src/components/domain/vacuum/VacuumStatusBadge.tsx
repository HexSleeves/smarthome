import type { RoborockStatus } from "@smarthome/shared"

const statusColors: Record<RoborockStatus, string> = {
  idle: "bg-gray-500",
  cleaning: "bg-green-500",
  returning: "bg-blue-500",
  charging: "bg-yellow-500",
  paused: "bg-orange-500",
  error: "bg-red-500",
  offline: "bg-gray-400",
}

const statusText: Record<RoborockStatus, string> = {
  idle: "Idle",
  cleaning: "Cleaning",
  returning: "Returning to dock",
  charging: "Charging",
  paused: "Paused",
  error: "Error",
  offline: "Offline",
}

type VacuumStatusBadgeProps = {
  status: RoborockStatus
}

export function VacuumStatusBadge({ status }: VacuumStatusBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${statusColors[status]}`} />
      <span className="font-medium">{statusText[status]}</span>
    </div>
  )
}
