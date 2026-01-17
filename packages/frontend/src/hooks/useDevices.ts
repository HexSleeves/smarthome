import { trpc } from "@/lib/trpc/client"

export function useDevices() {
  const { data, isLoading, error } = trpc.device.list.useQuery()

  return {
    devices: data?.devices ?? [],
    isLoading,
    error,
  }
}

export function useDevicesByType(type: "roborock" | "ring") {
  const { devices, isLoading, error } = useDevices()

  return {
    devices: devices.filter((d) => d.type === type),
    isLoading,
    error,
  }
}

export function useRecentEvents(limit = 20) {
  const { data, isLoading, error } = trpc.device.recentEvents.useQuery({ limit })

  return {
    events: data?.events ?? [],
    isLoading,
    error,
  }
}
