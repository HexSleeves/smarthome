import { Battery, Bell, Camera } from "lucide-react"
import type { RingDeviceState } from "@smarthome/shared"
import { DoorbellSnapshot } from "./DoorbellSnapshot"
import { DoorbellControls } from "./DoorbellControls"
import { DoorbellHistory } from "./DoorbellHistory"
import { DoorbellNotifications } from "./DoorbellNotifications"

type DoorbellDeviceProps = {
  device: RingDeviceState
  isAdmin: boolean
}

export function DoorbellDevice({ device, isAdmin }: DoorbellDeviceProps) {
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
            {device.type === "doorbell" ? (
              <Bell className="w-8 h-8 text-primary-600" />
            ) : (
              <Camera className="w-8 h-8 text-primary-600" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">{device.name}</h2>
            <p className="text-sm text-gray-500 capitalize">{device.type}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  device.status === "online" ? "bg-green-500" : "bg-gray-400"
                }`}
              />
              <span className="font-medium capitalize">{device.status}</span>
            </div>
            {device.battery !== null && (
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                <Battery className="w-4 h-4" />
                {device.battery}%
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Notifications */}
      <DoorbellNotifications deviceId={device.id} />

      {/* Snapshot */}
      <DoorbellSnapshot deviceId={device.id} />

      {/* Controls & History */}
      <div className="p-6 space-y-6">
        <DoorbellControls device={device} isAdmin={isAdmin} />
        <DoorbellHistory deviceId={device.id} />
      </div>
    </div>
  )
}
