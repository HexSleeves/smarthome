# Smart Home Project - Agent Context

## Project Overview

A smart home dashboard application with support for Roborock vacuums and Ring cameras.

**Stack:**
- Backend: Node.js + Fastify + tRPC + SQLite (packages/backend)
- Frontend: React + Vite + TailwindCSS (packages/frontend)
- Monorepo with shared types (packages/shared)

**Location:** `/home/exedev/smarthome`

## Recent Work: Roborock MQTT Commands

### Problem Solved
Roborock commands (start, stop, find, etc.) require MQTT protocol with a complex binary message format. Initial attempts to implement this in TypeScript failed due to protocol complexity.

### Solution Implemented
Used **python-roborock** library via a Python bridge script:

```
Node.js (tRPC) → spawn Python subprocess → python-roborock → MQTT → Device
```

### Key Files

1. **`packages/backend/scripts/roborock_bridge.py`**
   - Python script that receives JSON via stdin
   - Uses python-roborock's MQTT session and V1 protocol
   - Returns JSON results to stdout
   - Requires: `packages/backend/.venv` with python-roborock installed

2. **`packages/backend/src/services/roborock.ts`**
   - `sendCommand()` - calls Python bridge for commands
   - `callPythonBridge()` - spawns Python subprocess
   - `connectMqtt()` - establishes MQTT connection (still present but unused for commands)
   - `discoverDevices()` - fetches devices via REST API
   - Stores credentials in `this.credentials` Map
   - Stores device localKeys in `this.deviceLocalKeys` Map

3. **`packages/backend/src/trpc/routers/roborock.ts`**
   - tRPC router with endpoints: status, devices, auth, command, etc.
   - `command` mutation calls `roborockService.sendCommand()`

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
