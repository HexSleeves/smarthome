import { useRealtimeEvents } from "@/hooks"

export function LiveEvents() {
  const { events } = useRealtimeEvents(5)

  if (events.length === 0) {
    return null
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold mb-4">Live Events</h2>
      <div className="space-y-2">
        {events.map((event, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
          >
            <div
              className={`w-2 h-2 rounded-full ${
                event.type === "doorbell"
                  ? "bg-yellow-500"
                  : event.type === "motion"
                    ? "bg-blue-500"
                    : "bg-green-500"
              }`}
            />
            <span className="flex-1 text-sm">
              {event.type === "doorbell"
                ? "🔔 Doorbell pressed"
                : event.type === "motion"
                  ? "🚶 Motion detected"
                  : `🧹 Vacuum: ${event.state?.status || "status update"}`}
            </span>
            <span className="text-xs text-gray-500">
              {event.timestamp.toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
