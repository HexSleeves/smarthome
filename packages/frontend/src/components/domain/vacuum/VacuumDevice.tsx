import { AlertTriangle, Battery, Wind } from "lucide-react"
import type { RoborockDeviceState } from "@smarthome/shared"
import { VacuumStatusBadge } from "./VacuumStatusBadge"
import { VacuumStats } from "./VacuumStats"
import { VacuumControls } from "./VacuumControls"
import { VacuumFanSpeed } from "./VacuumFanSpeed"
import { VacuumWaterLevel } from "./VacuumWaterLevel"

type VacuumDeviceProps = {
  device: RoborockDeviceState
  isAdmin: boolean
}

export function VacuumDevice({ device, isAdmin }: VacuumDeviceProps) {
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
            <Wind className="w-8 h-8 text-primary-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">{device.name}</h2>
            <p className="text-sm text-gray-500">{device.model}</p>
          </div>
          <div className="text-right">
            <VacuumStatusBadge status={device.status} />
            <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
              <Battery className="w-4 h-4" />
              {device.battery}%
            </div>
          </div>
        </div>
      </div>

      {/* Error message */}
      {device.errorMessage && (
        <div className="px-6 py-3 bg-red-50 dark:bg-red-900/30 flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertTriangle className="w-5 h-5" />
          <span>{device.errorMessage}</span>
        </div>
      )}

      {/* Stats */}
      <VacuumStats device={device} />

      {/* Controls */}
      <div className="p-6 space-y-6">
        <VacuumControls deviceId={device.id} isAdmin={isAdmin} />
        <VacuumFanSpeed
          deviceId={device.id}
          currentSpeed={device.fanSpeed}
          isAdmin={isAdmin}
        />
        <VacuumWaterLevel
          deviceId={device.id}
          currentLevel={device.waterLevel}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  )
}
