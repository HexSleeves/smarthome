export type DeviceType = "roborock" | "ring"

export type Device = {
  id: string
  userId: string
  type: DeviceType
  name: string
  deviceId: string | null
  config: Record<string, unknown>
  status: string
  lastSeen: string | null
  createdAt: string
  updatedAt: string
  liveState?: RoborockDeviceState | RingDeviceState
}

export type DeviceEvent = {
  id: string
  deviceId: string
  type: string
  data: Record<string, unknown>
  createdAt: string
}

// Roborock types
export type RoborockStatus = "idle" | "cleaning" | "returning" | "charging" | "paused" | "error" | "offline"
export type RoborockFanSpeed = "quiet" | "balanced" | "turbo" | "max"
export type RoborockWaterLevel = "off" | "low" | "medium" | "high"

export type RoborockDeviceState = {
  id: string
  name: string
  model: string
  status: RoborockStatus
  battery: number
  fanSpeed: RoborockFanSpeed
  waterLevel: RoborockWaterLevel
  cleanArea: number
  cleanTime: number
  errorCode: number
  errorMessage: string | null
  lastClean: string | null
}

export type RoborockCleanHistory = {
  id: string
  startTime: number
  endTime: number
  duration: number
  area: number
}

// Ring types
export type RingDeviceType = "doorbell" | "camera" | "chime"
export type RingDeviceStatus = "online" | "offline"

export type RingDeviceState = {
  id: string
  name: string
  type: RingDeviceType
  status: RingDeviceStatus
  battery: number | null
  hasLight: boolean
  hasSiren: boolean
  lastMotion: string | null
  lastDing: string | null
}

export type RingEvent = {
  id: string
  createdAt: string
  kind: string
  favorite: boolean
  snoozed: boolean
}
