# Smart Home Project - Agent Context

## Project Overview

A smart home dashboard application with support for Roborock vacuums and Ring cameras.

**Stack:**
- Backend: Node.js + Fastify + tRPC + SQLite (packages/backend)
- Frontend: React + Vite + TailwindCSS (packages/frontend)
- Monorepo with shared types (packages/shared)

**Location:** `/home/exedev/smarthome`

## Recent Work: Comprehensive Improvements

### Roborock MQTT via Python Bridge
Roborock commands use MQTT protocol via **python-roborock** library:

```
Node.js (tRPC) → spawn Python subprocess → python-roborock → MQTT → Device
```

### Key Files

1. **`packages/backend/scripts/roborock_bridge.py`**
   - Python script that receives JSON via stdin
   - Actions: `command` (send commands), `get_status` (real-time status)
   - Returns JSON results to stdout
   - Requires: `packages/backend/.venv` with python-roborock installed

2. **`packages/backend/src/services/roborock.ts`**
   - `sendCommand()` - returns `CommandResult` with error details and category
   - `getDeviceStatusViaMqtt()` - real-time status via Python bridge
   - `callPythonBridge()` - spawns Python subprocess
   - `discoverDevices()` - fetches devices via REST API
   - Error categorization: `device_offline`, `auth_expired`, `command_timeout`, etc.

3. **`packages/backend/src/trpc/routers/roborock.ts`**
   - tRPC router with endpoints: status, devices, auth, command, deviceStatus, etc.
   - Returns meaningful error messages to frontend

4. **`packages/backend/src/services/ring.ts`**
   - Ring camera/doorbell integration
   - HLS live streaming via FFmpeg
   - Motion and doorbell event subscriptions
   - Proper error handling for all operations

5. **`packages/backend/src/routes/websocket.ts`**
   - Real-time event delivery for Ring and Roborock
   - Subscription tracking to prevent duplicates
   - Handlers: `subscribe:ring`, `unsubscribe:ring`, `ping`

### Python Virtual Environment

```bash
cd packages/backend
source .venv/bin/activate
# python-roborock and dependencies installed
```

### Working Commands
- `find_me` (find robot)
- `app_start` (start cleaning)
- `app_stop` (stop cleaning)
- `app_pause` (pause cleaning)
- `app_charge` (return to dock)

### Authentication Flow
1. User provides email via frontend
2. Backend calls Roborock API to send 2FA code
3. User enters code
4. Backend receives `rriot` credentials (contains MQTT auth info)
5. Credentials stored encrypted in SQLite `device_credentials` table
6. On startup, credentials loaded and devices discovered via REST API

### Important Data Structures

```typescript
interface RRiot {
  u: string;  // user id
  s: string;  // secret
  h: string;  // hmac key
  k: string;  // key
  r: RRiotReference;  // { a: api_url, m: mqtt_url }
}

interface RoborockCredentials {
  token: string;
  userId: string;
  homeId: string;
  rruid?: string;
  baseURL: string;
  rriot?: RRiot;
}
```

### MQTT Topic Format
- Subscribe: `rr/m/o/{rriot.u}/{mqtt_user}/{device_id}`
- Publish: `rr/m/i/{rriot.u}/{mqtt_user}/{device_id}`
- `mqtt_user` = `md5(rriot.u + ":" + rriot.k)[2:10]`

## Server Configuration

- Backend runs on port 3000
- Nginx proxies port 8000 → 3000
- Access via: https://noon-disk.exe.xyz:8000

### Starting the Backend

```bash
cd /home/exedev/smarthome/packages/backend
PORT=3000 npm exec tsx src/index.ts
```

### Database

- SQLite at `packages/backend/data/smarthome.db`
- Tables: users, devices, device_credentials, refresh_tokens, etc.

## Environment

```bash
# packages/backend/.env
PORT=3000
HOST=0.0.0.0
JWT_SECRET=dev-jwt-secret-change-in-production
COOKIE_SECRET=dev-cookie-secret-change-in-production
ENCRYPTION_SECRET=dev-encryption-secret-change-in-production
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
```

## Test User

- Email: `lecoqjacob@gmail.com`
- Password: `adminpassword`
- Role: admin

## Known Issues / TODOs

1. **Ring integration** - Basic support exists but may need work
2. **MQTT connection cleanup** - Old TypeScript MQTT code still in roborock.ts (unused but present)
3. **Python bridge timeout** - Currently 60s, may need adjustment for slow operations
4. **Error handling** - Python bridge errors could be more descriptive

## Useful Commands

```bash
# Check backend logs
tail -f /tmp/backend.log

# Test Roborock command
TOKEN=$(curl -s 'http://localhost:3000/api/trpc/auth.login?batch=1' \
  -H 'content-type: application/json' \
  --data-raw '{"0":{"json":{"email":"lecoqjacob@gmail.com","password":"adminpassword"}}}' | jq -r '.[0].result.data.json.accessToken')

curl -s 'http://localhost:3000/api/trpc/roborock.command?batch=1' \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  --data-raw '{"0":{"json":{"deviceId":"DEVICE_ID","command":"find"}}}'

# Test Python bridge directly
cd packages/backend
source .venv/bin/activate
echo '{"rriot": {...}, "device_id": "...", "local_key": "...", "command": "find_me"}' | python scripts/roborock_bridge.py command
```

## Code Quality

- SonarQube warning was fixed by extracting `getStatusFromDpsState()` and `determineDeviceStatus()` helper functions to reduce cognitive complexity in roborock.ts

## Git Status

Latest commit: `feat(roborock): implement MQTT commands via python-roborock bridge`

## Completed Work

### ✅ Clean up unused MQTT code in roborock.ts
- Removed TypeScript MQTT code (connectMqtt, handleMqttMessage, etc.)
- Removed mqtt npm dependency
- Python bridge is now the sole MQTT mechanism

### ✅ Improve error handling
- `sendCommand()` returns `CommandResult` with error details and category
- Error categorization: `device_offline`, `auth_expired`, `command_timeout`, `missing_credentials`
- tRPC router surfaces meaningful error messages to frontend

### ✅ Device status polling via Python bridge
- Added `get_status` action to Python bridge
- Added `getDeviceStatusViaMqtt()` method
- Added `RoborockMqttStatus` interface
- Added `deviceStatus` tRPC endpoint

### ✅ Ring camera improvements
- Fixed tRPC router to return actual results instead of always success
- Added proper error handling for toggleLight, triggerSiren, connect
- Fixed stream cleanup on failure
- Updated shared types with error fields

### ✅ WebSocket improvements
- Added subscription tracking to prevent duplicates
- Added `unsubscribe:ring` message handler
- Refactored Ring subscription into helper functions

## Next Steps

### High Priority

1. **Add more Roborock commands to frontend**
   - Room-specific cleaning (`app_segment_clean`)
   - Fan speed control (`set_custom_mode`) - backend done, need frontend UI
   - Water level control (`set_water_box_custom_mode`) - backend done, need frontend UI
   - Get clean history

2. **Add retry logic for transient failures**
   - Retry on command_timeout errors
   - Exponential backoff for device_offline

### Medium Priority

3. **Frontend enhancements**
   - Real-time status updates via WebSocket (use roborock:status events)
   - Fan speed / water level controls UI
   - Map display for Roborock (if supported by device)
   - Clean history visualization

4. **Integrate MQTT status polling into frontend**
   - Use deviceStatus endpoint for on-demand refresh
   - Show more detailed status (fan speed, water level, clean area, etc.)

### Low Priority

5. **Performance optimization**
   - Consider keeping Python process alive instead of spawning per-command
   - Could use a simple HTTP server in Python or Unix socket
   - Would reduce latency from ~1s to ~100ms per command

6. **Testing**
   - Add integration tests for Roborock commands
   - Mock the Python bridge for unit tests
   - Add E2E tests for critical flows

7. **Documentation**
   - API documentation for tRPC endpoints
   - Setup guide for new developers
   - Deployment instructions

### Technical Debt

8. **Code cleanup**
   - Remove unused imports and variables
   - Fix any remaining ESLint/TypeScript warnings
   - Consolidate duplicate code patterns

9. **Security review**
   - Audit credential storage
   - Review JWT token handling
   - Ensure proper input validation
