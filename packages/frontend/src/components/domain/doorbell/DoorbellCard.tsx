import { Battery } from "lucide-react"
import type { Device, RingDeviceState } from "@smarthome/shared"

type DoorbellCardProps = {
  doorbell: Device
}

export function DoorbellCard({ doorbell }: DoorbellCardProps) {
  const state = doorbell.liveState as RingDeviceState | undefined

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
      <div
        className={`w-3 h-3 rounded-full ${
          state?.status === "online" ? "bg-green-500" : "bg-gray-400"
        }`}
      />
      <div className="flex-1">
        <p className="font-medium">{doorbell.name}</p>
        <p className="text-sm text-gray-500 capitalize">
          {state?.type || "Doorbell"}
        </p>
      </div>
      {state?.battery !== undefined && state?.battery !== null && (
        <div className="flex items-center gap-1 text-sm">
          <Battery className="w-4 h-4" />
          {state.battery}%
        </div>
      )}
    </div>
  )
}
