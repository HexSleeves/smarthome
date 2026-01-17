import type { RoborockDeviceState } from "./device"

export type WsRoborockStatusEvent = {
  type: "roborock:status"
  deviceId: string
  state: RoborockDeviceState
}

export type WsRingMotionEvent = {
  type: "ring:motion"
  deviceId: string
  deviceName: string
  timestamp: string
}

export type WsRingDingEvent = {
  type: "ring:ding"
  deviceId: string
  deviceName: string
  timestamp: string
}

export type WsEvent = WsRoborockStatusEvent | WsRingMotionEvent | WsRingDingEvent

// Realtime event for dashboard display
export type RealtimeEventType = "vacuum_status" | "motion" | "doorbell"

export type RealtimeEvent = {
  type: RealtimeEventType
  timestamp: Date
  deviceId?: string
  deviceName?: string
  state?: RoborockDeviceState
}
