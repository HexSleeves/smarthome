import { Wifi } from "lucide-react"
import { Link } from "react-router-dom"
import { useDevicesByType, useRoborockStatus } from "@/hooks"
import { VacuumCard } from "@/components/domain/vacuum"
import { EmptyState } from "@/components/ui"

export function VacuumSection() {
  const { connected, hasCredentials } = useRoborockStatus()
  const { devices: vacuums } = useDevicesByType("roborock")

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Wifi className="w-5 h-5 text-primary-600" />
          Robot Vacuum
        </h2>
        <Link
          to="/vacuum"
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          View All →
        </Link>
      </div>

      {!connected && !hasCredentials ? (
        <EmptyState
          icon={Wifi}
          title="No vacuum connected"
          actionLabel="Connect your Roborock"
          actionLink="/settings"
        />
      ) : vacuums.length > 0 ? (
        <div className="space-y-3">
          {vacuums.map((vacuum) => (
            <VacuumCard key={vacuum.id} vacuum={vacuum} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>Connecting to vacuum...</p>
        </div>
      )}
    </div>
  )
}
