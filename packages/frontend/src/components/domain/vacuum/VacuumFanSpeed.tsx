import { Wind } from "lucide-react"
import { clsx } from "clsx"
import { useRoborockCommands } from "@/hooks"
import type { RoborockFanSpeed } from "@smarthome/shared"

const fanSpeeds: { value: RoborockFanSpeed; label: string; icon: string }[] = [
  { value: "quiet", label: "Quiet", icon: "🤫" },
  { value: "balanced", label: "Balanced", icon: "⚖️" },
  { value: "turbo", label: "Turbo", icon: "💨" },
  { value: "max", label: "Max", icon: "🚀" },
]

type VacuumFanSpeedProps = {
  deviceId: string
  currentSpeed: RoborockFanSpeed
  isAdmin: boolean
}

export function VacuumFanSpeed({ deviceId, currentSpeed, isAdmin }: VacuumFanSpeedProps) {
  const { setFanSpeed, isPending } = useRoborockCommands(deviceId)

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
        <Wind className="w-4 h-4" />
        Fan Speed
      </h3>
      <div className="flex flex-wrap gap-2">
        {fanSpeeds.map((speed) => (
          <button
            key={speed.value}
            onClick={() => setFanSpeed(speed.value)}
            disabled={!isAdmin || isPending}
            className={clsx(
              "px-4 py-2 rounded-lg border transition-colors",
              currentSpeed === speed.value
                ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                : "border-gray-200 dark:border-gray-600 hover:border-primary-300"
            )}
            type="button"
          >
            {speed.icon} {speed.label}
          </button>
        ))}
      </div>
    </div>
  )
}
