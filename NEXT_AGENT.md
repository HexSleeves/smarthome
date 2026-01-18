## Ring Doorbell Live Streaming - In Progress

### Current Status
WebRTC streaming infrastructure is built but Ring API is returning 500 errors.

### What's Done
1. **Backend** (`packages/backend/src/services/ring.ts`)
   - Added `startWebRtcSession()` using ring-client-api's `SimpleWebRtcSession`
   - Added `stopWebRtcSession()` and `activateCameraSpeaker()`
   - Session management with cleanup on shutdown

2. **Backend tRPC endpoints** (`packages/backend/src/trpc/routers/ring.ts`)
   - `ring.startStream` - Takes SDP offer, returns SDP answer
   - `ring.stopStream` - Ends streaming session
   - `ring.activateSpeaker` - Enables two-way audio

3. **Frontend** (`packages/frontend/src/hooks/useRingStream.ts`)
   - WebRTC peer connection management
   - SDP offer generation with STUN servers
   - ICE candidate gathering
   - State management (idle/connecting/streaming/error)

4. **UI** (`packages/frontend/src/components/domain/doorbell/`)
   - `DoorbellLiveStream.tsx` - Live streaming component with play/stop/retry
   - `DoorbellDevice.tsx` - Tabs for Live Stream vs Snapshot view

### Current Issue
Ring's API (`api.ring.com/integrations/v1/liveview/start`) returns HTTP 500:
```
error_code: 'INTERNAL_ERROR'
```

### Possible Causes
1. Ring may have changed/deprecated this API endpoint
2. Device may not support WebRTC streaming via this method
3. SDP format may need specific modifications for Ring
4. May need additional authentication or headers

### Alternative Approaches to Try
1. **Use `streamVideo()` with ffmpeg** - Transcode WebRTC to HLS on server
2. **Use on-device recording** - Fetch recorded clips instead of live stream  
3. **Check ring-client-api GitHub issues** for known WebRTC problems
4. **Use RTSP** if the doorbell supports it (some Ring devices do)

### Testing
```bash
# Start the app
sudo systemctl restart smarthome

# View logs
sudo journalctl -u smarthome -f

# Access at
http://localhost:3000/doorbell
```

### Files Changed
- `packages/backend/src/services/ring.ts` - WebRTC session methods
- `packages/backend/src/trpc/routers/ring.ts` - Stream endpoints
- `packages/frontend/src/hooks/useRingStream.ts` - WebRTC hook
- `packages/frontend/src/components/domain/doorbell/DoorbellLiveStream.tsx`
- `packages/frontend/src/components/domain/doorbell/DoorbellDevice.tsx`
