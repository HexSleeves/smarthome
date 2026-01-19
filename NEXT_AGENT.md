## Ring Doorbell Live Streaming - HLS Implementation Complete

### Current Status

HLS live streaming is now implemented and working. The backend uses `camera.streamVideo()` from ring-client-api with ffmpeg to transcode the stream to browser-compatible HLS format.

### What's Done

1. **Backend HLS Streaming** (`packages/backend/src/services/ring.ts`)
   - `startHlsStream()` - Starts ffmpeg transcoding to HLS
   - `stopHlsStream()` - Stops the stream and cleans up
   - `getStreamOutputDir()` - Gets the output directory for serving HLS files
   - Session management with auto-cleanup on idle/expiry
   - Stream timeout after 60s idle or 10min max duration

2. **HLS File Serving** (`packages/backend/src/routes/ring-snapshot.ts`)
   - `/api/ring/stream/:sessionId/:filename` - Serves HLS files (m3u8 and .ts)
   - Supports both query param token and Bearer auth header
   - Updates stream activity on each file request

3. **Backend tRPC endpoints** (`packages/backend/src/trpc/routers/ring.ts`)
   - `ring.startStream` - Starts HLS stream, returns stream URL
   - `ring.stopStream` - Ends streaming session
   - `ring.streamStatus` - Checks if stream is active

4. **Frontend** (`packages/frontend/src/hooks/useRingStream.ts`)
   - HLS.js integration for browser playback
   - Auth token passed via Authorization header
   - Retry logic for manifest loading
   - State management (idle/connecting/streaming/error)

5. **UI** (`packages/frontend/src/components/domain/doorbell/`)
   - `DoorbellLiveStream.tsx` - Live streaming component with play/stop
   - Shows LIVE indicator when streaming

### FFmpeg Configuration

The stream uses these ffmpeg options for browser compatibility:

- Audio: AAC-LC codec, 44100Hz, stereo, 128kbps
- Video: Copy H264 (no re-encoding for speed)
- HLS: 2-second segments, 6 segments in playlist, auto-delete old segments

### Stream Files

HLS files are written to `/tmp/ring-streams/<session-id>/`:

- `stream.m3u8` - HLS playlist
- `stream*.ts` - Video segments (~2 seconds each)

### Testing Notes

**Important**: The headless browser used for automated testing doesn't have MediaSource/codec support. HLS streaming must be tested in a real browser:

```bash
# Start the app
sudo systemctl restart smarthome

# View logs
sudo journalctl -u smarthome -f

# Access in your browser (not headless)
https://noon-disk.exe.xyz:3000/doorbell
```

### Known Issues

1. **Stream Startup Time**: Takes 5-6 seconds for first HLS segment to be ready
2. **High Profile H264**: Ring cameras use H264 High profile which some browsers may not support. If issues persist, may need to transcode video to baseline profile (slower)
3. **Token Expiry**: JWT tokens have 15-minute expiry; stream may fail if token expires during long stream

### Files Changed

- `packages/backend/src/services/ring.ts` - HLS streaming service methods
- `packages/backend/src/routes/ring-snapshot.ts` - HLS file serving endpoint
- `packages/backend/src/trpc/routers/ring.ts` - Stream tRPC endpoints
- `packages/frontend/src/hooks/useRingStream.ts` - HLS.js hook
- `packages/frontend/src/components/domain/doorbell/DoorbellLiveStream.tsx` - UI component
- `packages/frontend/package.json` - Added hls.js dependency
