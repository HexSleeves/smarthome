import { Bell } from "lucide-react"
import { useRingStatus, useRingDevices } from "@/hooks"
import { useAuthStore } from "@/stores/auth"
import { EmptyState, PageSpinner } from "@/components/ui"
import { DoorbellDevice } from "@/components/domain/doorbell"

export function DoorbellPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === "admin"

  const { connected, hasCredentials } = useRingStatus()
  const { devices, isLoading } = useRingDevices()

  if (!connected && !hasCredentials) {
    return (
      <EmptyState
        icon={Bell}
        title="No Doorbell Connected"
        description="Connect your Ring doorbell in Settings to get started."
        actionLabel="Go to Settings"
        actionLink="/settings"
      />
    )
  }

  if (isLoading) {
    return <PageSpinner />
  }

  if (devices.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No Devices Found"
        description="Make sure your Ring device is set up in the Ring app."
      />
    )
  }

  return (
    <div className="space-y-6">
      {devices.map((device) => (
        <DoorbellDevice key={device.id} device={device} isAdmin={isAdmin} />
      ))}
    </div>
  )
}
