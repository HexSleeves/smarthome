import { RefreshCw, Video } from "lucide-react"
import { useState } from "react"
import { ringApi } from "@/lib/api"

type DoorbellSnapshotProps = {
  deviceId: string
}

export function DoorbellSnapshot({ deviceId }: DoorbellSnapshotProps) {
  const [snapshotKey, setSnapshotKey] = useState(0)
  const snapshotUrl = `${ringApi.snapshotUrl(deviceId)}&t=${snapshotKey}`

  return (
    <div className="p-6 bg-gray-900">
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <img
          src={snapshotUrl}
          alt="Camera snapshot"
          className="w-full h-full object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none"
          }}
        />
        <div className="absolute bottom-4 right-4 flex gap-2">
          <button
            onClick={() => setSnapshotKey((k) => k + 1)}
            className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            title="Refresh snapshot"
            type="button"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
        <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600 text-white text-sm">
          <Video className="w-4 h-4" />
          Live
        </div>
      </div>
      <p className="text-center text-gray-400 text-sm mt-2">
        Snapshot view - Full live streaming requires WebRTC setup
      </p>
    </div>
  )
}
