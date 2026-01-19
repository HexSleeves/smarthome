# Next Agent Instructions - Roborock Integration Fix

## Current State

The Roborock integration is **partially working** but cannot fetch device lists due to missing HAWK authentication.

### What Works
- User can authenticate with Roborock via 2FA (v4 API)
- `getHomeDetail` API call succeeds and returns `rrHomeId`
- Token is stored in database
- Authorization header format fixed (was using `Bearer` prefix, now uses raw token)

### What Doesn't Work
- Device list is always empty (0 devices found)
- Cannot send commands to vacuum
- Cannot get device status

## Root Cause

The Roborock API has a two-tier architecture:

1. **Basic API** (`https://usiot.roborock.com/api/v1/*`)
   - Used for: login, getHomeDetail
   - Auth: Simple token in `Authorization` header
   - ✅ This works

2. **IoT API** (`https://{rriot.r.a}/user/homes/{homeId}`)
   - Used for: device list, commands, status
   - Auth: **HAWK authentication** using `rriot` credentials
   - ❌ Not implemented

The current implementation uses **v4 login API** which returns:
```json
{
  "token": "...",
  "userid": "...",
  "rruid": "..."
}
```

But the **v1 login API** returns additional `rriot` data needed for HAWK auth:
```json
{
  "token": "...",
  "rriot": {
    "u": "user_id",
    "s": "secret",
    "h": "hmac_key", 
    "k": "key",
    "r": {
      "a": "api.roborock.com",
      "m": "mqtt.roborock.com",
      "l": "..."
    }
  }
}
```

## Required Changes

### 1. Update Credentials Interface
File: `packages/backend/src/services/roborock.ts`

```typescript
interface RoborockCredentials {
  token: string;
  userId: string;
  homeId: string;
  rruid?: string;
  baseURL: string;
  // ADD these fields:
  rriot?: {
    u: string;
    s: string;
    h: string;
    k: string;
    r: {
      a: string;  // IoT API endpoint
      m?: string; // MQTT endpoint
      l?: string;
    };
  };
}
```

### 2. Switch to v1 Login API

Replace current v4 endpoints:
- `api/v4/email/code/send` → `api/v1/sendEmailCode`
- `api/v4/auth/email/login/code` → `api/v1/loginWithCode`

v1 sendEmailCode:
```
POST /api/v1/sendEmailCode
Params: username={email}&type=auth
Headers: header_clientid={md5(email+deviceId).base64}
```

v1 loginWithCode:
```
POST /api/v1/loginWithCode
Params: username={email}&verifycode={code}&verifycodetype=AUTH_EMAIL_CODE
Headers: header_clientid={md5(email+deviceId).base64}
```

### 3. Implement HAWK Authentication

For IoT API calls, generate HAWK auth header:

```typescript
function getHawkAuthentication(rriot: RRiot, url: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(6).toString('base64url');
  
  const prestr = [
    rriot.u,
    rriot.s,
    nonce,
    timestamp.toString(),
    crypto.createHash('md5').update(url).digest('hex'),
    '',
    ''
  ].join(':');
  
  const mac = crypto
    .createHmac('sha256', rriot.h)
    .update(prestr)
    .digest('base64');
  
  return `Hawk id="${rriot.u}", s="${rriot.s}", ts="${timestamp}", nonce="${nonce}", mac="${mac}"`;
}
```

### 4. Update Device Discovery

```typescript
async discoverDevices(userId: string): Promise<void> {
  const creds = this.credentials.get(userId);
  if (!creds?.rriot) {
    log.warn('Missing rriot credentials - cannot fetch devices');
    return;
  }

  // Get home ID from basic API
  const homeId = await this.getHomeId(creds);
  
  // Fetch devices from IoT API with HAWK auth
  const iotApiUrl = `https://${creds.rriot.r.a}`;
  const devicesPath = `/user/homes/${homeId}`;
  
  const response = await fetch(`${iotApiUrl}${devicesPath}`, {
    headers: {
      Authorization: this.getHawkAuthentication(creds.rriot, devicesPath)
    }
  });
  
  const data = await response.json();
  // data.result.devices contains the device list
}
```

## Reference Implementation

See the Python implementation for reference:
- https://github.com/Lash-L/python-roborock/blob/main/roborock/web_api.py
- Key functions: `code_login`, `get_home_data`, `_get_hawk_authentication`

## Files to Modify

1. `packages/backend/src/services/roborock.ts` - Main service file
   - Update `RoborockCredentials` interface
   - Change login to use v1 API
   - Store `rriot` from login response
   - Implement HAWK auth function
   - Update `discoverDevices` to use IoT API

## Testing

After changes:
1. Clear existing Roborock credentials: 
   ```sql
   DELETE FROM device_credentials WHERE provider='roborock';
   ```
2. Restart service: `sudo systemctl restart smarthome`
3. Re-authenticate via Settings page
4. Check logs: `journalctl -u smarthome -f | grep roborock`
5. Verify devices appear in UI

## Current Logs Show

```
Roborock getHomeDetail response: {"code":200,"data":{"rrHomeId":5207156,...}}
Home found. Device list requires HAWK authentication
Roborock devices endpoint response: {"code":1002,"msg":"parameter error"}
Device discovery complete: deviceCount=0
```

The user has home ID 5207156 but no devices are returned because we can't call the IoT API without HAWK auth.
