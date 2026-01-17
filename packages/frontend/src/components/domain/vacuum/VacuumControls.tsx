import { Home, Pause, Play, Square, Volume2 } from "lucide-react"
import { useRoborockCommands } from "@/hooks"

type VacuumControlsProps = {
  deviceId: string
  isAdmin: boolean
}

export function VacuumControls({ deviceId, isAdmin }: VacuumControlsProps) {
  const { sendCommand, isPending } = useRoborockCommands(deviceId)

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-500 mb-3">Controls</h3>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => sendCommand("start")}
          disabled={!isAdmin || isPending}
          className="btn btn-primary flex items-center gap-2"
          type="button"
        >
          <Play className="w-4 h-4" />
          Start
        </button>
        <button
          onClick={() => sendCommand("pause")}
          disabled={!isAdmin || isPending}
          className="btn btn-secondary flex items-center gap-2"
          type="button"
        >
          <Pause className="w-4 h-4" />
          Pause
        </button>
        <button
          onClick={() => sendCommand("stop")}
          disabled={!isAdmin || isPending}
          className="btn btn-secondary flex items-center gap-2"
          type="button"
        >
          <Square className="w-4 h-4" />
          Stop
        </button>
        <button
          onClick={() => sendCommand("home")}
          disabled={!isAdmin || isPending}
          className="btn btn-secondary flex items-center gap-2"
          type="button"
        >
          <Home className="w-4 h-4" />
          Dock
        </button>
        <button
          onClick={() => sendCommand("find")}
          disabled={!isAdmin || isPending}
          className="btn btn-secondary flex items-center gap-2"
          type="button"
        >
          <Volume2 className="w-4 h-4" />
          Find
        </button>
      </div>
      {!isAdmin && (
        <p className="text-sm text-gray-500 mt-2">
          Admin access required to control the vacuum.
        </p>
      )}
    </div>
  )
}
