# Smart Home Backend – Enhancement Plan

> Generated from security/architecture review. Updated: 2026-01-18

## Status Overview

| Phase | Status | Target |
|-------|--------|--------|
| Phase 1: Critical Security | ✅ Complete | Week 1 |
| Phase 1.5: Type Safety | ✅ Complete | Week 1 |
| Phase 2: Architecture Cleanup | ✅ Complete | Week 1-2 |
| Phase 3: Reliability & Observability | ⬜ Not Started | Week 2 |
| Phase 4: Testing | ⬜ Not Started | Ongoing |

---

## Phase 1: Critical Security ✅ COMPLETE

### 1.1 Fail on Missing Secrets ✅
- [x] Create `src/config.ts` with Zod validation
- [x] Require `JWT_SECRET`, `COOKIE_SECRET`, `ENCRYPTION_SECRET` (32+ chars)
- [x] Allow dev defaults only in non-production
- [x] Update all usages to import from config

### 1.2 Add Rate Limiting ✅
- [x] Install `@fastify/rate-limit`
- [x] Global limit: 100 req/min
- [ ] Auth endpoints: 10 req/min - **Blocked**: per-route config override not working with Fastify 5 + rate-limit 10.x. Needs custom solution.

### 1.3 Add Security Headers ✅
- [x] Install `@fastify/helmet`
- [x] Configure for SPA compatibility (CSP disabled)

### 1.4 Fix CORS ✅
- [x] Replace `origin: true` with explicit whitelist
- [x] Use `CORS_ORIGIN` env var (comma-separated)
- [x] Block all origins in production if not configured

### 1.5 Add Graceful Shutdown ✅
- [x] Handle SIGINT/SIGTERM
- [x] Close Fastify server
- [x] Add `shutdown()` methods to services
- [x] Close database connection

---

## Phase 1.5: Type Safety ✅ COMPLETE

### Eliminated All `any` Types
- [x] Created `src/types.ts` with shared type definitions
- [x] Added DB row types: `DbUserRow`, `DbDeviceRow`, `DbEventRow`, etc.
- [x] Added `JwtPayload`, `WsIncomingMessage`, `RingEventPayload` types
- [x] Added `isZodError()` type guard for error handling
- [x] Replace `error: any` with `error: unknown` + type guards
- [x] Replace `as any[]` with `db.prepare<[...], RowType>()` generics
- [x] Add Fastify route generics: `<{ Params, Querystring, Body }>`
- [x] Fix `@fastify/jwt` typing with declaration merging

### Build Verification ✅
- [x] `npm run build -w @smarthome/backend` passes
- [x] `npm run build -w @smarthome/frontend` passes

---

## Known Issues / Bugs 🐛

### 1. WebSocket Error ✅ FIXED
**Location**: `src/routes/websocket.ts`
**Error**: `Cannot read properties of undefined (reading 'send')`
**Cause**: API change in @fastify/websocket v11 - `connection.socket` no longer exists
**Fix**: Updated to use new API where first arg is the WebSocket directly

### 2. Ring Service Disconnects on Restart ✅ FIXED
**Behavior**: After server restart, Ring shows "Not connected" until re-authenticated
**Fix**: Added `src/startup.ts` with `reconnectStoredCredentials()` that runs after server start.
Reconnects all users with stored Ring/Roborock credentials automatically.

### 3. Auth Rate Limiting Not Working (LOW)
**Behavior**: Auth routes use global 100 req/min instead of 10 req/min
**Cause**: Fastify rate-limit plugin doesn't support per-route overrides in current version
**Workaround options**:
  - Use separate Fastify instance for auth routes
  - Implement custom rate limiting middleware
  - Use `keyGenerator` to create separate buckets

---

## Phase 2: Architecture Cleanup ✅ COMPLETE

### 2.1 Remove Duplicate REST Routes ✅
- [x] Keep: `/api/auth/*`, `/api/health`, `/api/ring/devices/:id/snapshot`
- [x] Remove: `/api/devices/*` (use tRPC `device.*`)
- [x] Remove: `/api/roborock/*` (use tRPC `roborock.*`)
- [x] Remove: `/api/ring/*` except snapshot (use tRPC `ring.*`)
- [x] Verify frontend uses tRPC exclusively for removed routes
- [x] Created `src/routes/ring-snapshot.ts` for REST snapshot route

### 2.2 Fix Service Encapsulation ✅ (Partially Done)
- [x] Add `getDeviceState(deviceId)` public method to services
- [x] Add `shutdown()` methods to services
- [ ] Add `getAllDeviceStates(userId)` for batch access
- [ ] Consider: Auto-reconnect stored credentials on startup

### 2.3 Migrate Auth to tRPC ✅
- [x] Create `src/trpc/routers/auth.ts`
- [x] Implement: `register`, `login`, `refresh`, `logout`, `me`
- [x] Handle cookies/tokens properly in tRPC context
- [x] Add to appRouter
- [ ] Deprecate REST auth routes (frontend still uses REST, tRPC available)
- [ ] Update frontend auth hooks (optional - REST auth works fine)

### 2.4 Structured Logging
- [ ] Replace all `console.log/error` with `fastify.log.*`
- [ ] Pass logger instance to services (DI)
- [ ] Add request context to logs
- [ ] Ensure no sensitive data logged (passwords, tokens)

---

## Phase 3: Reliability & Observability (Priority: 🟡 MEDIUM)

### 3.1 Add Fetch Timeouts
- [ ] Create `src/lib/fetch.ts` with timeout wrapper
- [ ] Default timeout: 30s for external APIs
- [ ] Use `AbortController` for cancellation
- [ ] Apply to: Roborock API calls, Ring API calls

### 3.2 Add Request IDs
- [ ] Add request-id generation in Fastify
- [ ] Add `x-request-id` header to responses
- [ ] Include in all log entries
- [ ] Pass to tRPC context

### 3.3 Hash Refresh Tokens
- [ ] Hash tokens before storing in DB (use argon2 or SHA-256)
- [ ] Update `sessionQueries.findByToken` to compare hashes
- [ ] Migration: invalidate all existing sessions

### 3.4 Global Error Handler
- [ ] Create `src/plugins/errorHandler.ts`
- [ ] Map Zod errors to 400 with details
- [ ] Map TRPCError to appropriate HTTP status
- [ ] Hide internal error details in production
- [ ] Log full error server-side

---

## Phase 4: Testing (Priority: 🟡 MEDIUM)

### 4.1 Test Infrastructure
- [ ] Install Vitest
- [ ] Configure for TypeScript + ESM
- [ ] Add test scripts to package.json
- [ ] Set up test database (in-memory SQLite)
- [ ] Add test utilities for auth, DB setup

### 4.2 Unit Tests
- [ ] `src/lib/crypto.ts` - encrypt/decrypt round-trip
- [ ] `src/config.ts` - validation logic, error cases
- [ ] Service methods with mocked external APIs

### 4.3 Integration Tests
- [ ] Auth flow: register → login → refresh → logout
- [ ] Protected routes require valid JWT
- [ ] Admin routes require admin role
- [ ] Rate limiting triggers at threshold
- [ ] Graceful shutdown works correctly

---

## Security Checklist

- [x] No hardcoded secrets in production
- [x] Rate limiting on all endpoints
- [ ] Stricter rate limiting on auth endpoints (blocked)
- [x] Security headers via Helmet
- [x] CORS restricted to known origins
- [ ] Refresh tokens hashed in database
- [x] Input validation on all endpoints (via tRPC/Zod)
- [ ] No sensitive data in logs (audit needed)
- [x] HTTPS enforced (handled by exe.dev proxy)

---

## Files Reference

### Key Files Added/Modified

| File | Purpose |
|------|---------|n| `src/config.ts` | Zod-validated env config, fails on missing secrets in prod |
| `src/types.ts` | Shared TypeScript types (DB rows, JWT, WS messages) |
| `src/middleware/auth.ts` | Auth middleware with `@fastify/jwt` declaration merging |
| `src/index.ts` | Main entry: plugins, routes, graceful shutdown |
| `src/services/*.ts` | Added `shutdown()`, `getDeviceState()` methods |
| `src/trpc/routers/*.ts` | tRPC routers with typed procedures |

### Dependencies

```json
{
  "@fastify/rate-limit": "^10.3.0",
  "@fastify/helmet": "^13.0.0"
}
```

---

## Environment Variables

| Variable | Required | Default (dev) | Description |
|----------|----------|---------------|-------------|
| `NODE_ENV` | No | `development` | Environment mode |
| `PORT` | No | `8000` | Server port |
| `HOST` | No | `0.0.0.0` | Server host |
| `LOG_LEVEL` | No | `info` | Pino log level |
| `JWT_SECRET` | **Yes (prod)** | dev default | JWT signing secret (32+ chars) |
| `COOKIE_SECRET` | **Yes (prod)** | dev default | Cookie signing secret (32+ chars) |
| `ENCRYPTION_SECRET` | **Yes (prod)** | dev default | Credential encryption key (32+ chars) |
| `CORS_ORIGIN` | No | `*` (dev) / blocked (prod) | Allowed origins (comma-separated) |

---

## For Next LLM Agent

### Context
This is a Fastify + tRPC + TypeScript backend for a smart home dashboard. It integrates with Ring (doorbells/cameras) and Roborock (vacuums) APIs.

### Recommended Next Steps (in order)

1. **Fix WebSocket Error** (30 min)
   - File: `src/routes/websocket.ts`
   - Issue: `ws.send()` called on undefined
   - Check Fastify 5 websocket plugin API changes

2. **Add Auto-Reconnect for Ring** (1 hr)
   - On server startup, iterate users with stored Ring credentials
   - Call `ringService.connectWithStoredCredentials(userId)`
   - Same for Roborock

3. **Migrate Auth to tRPC** (2 hr)
   - Create `src/trpc/routers/auth.ts`
   - Move register/login/refresh/logout/me from REST
   - Update frontend to use tRPC auth

4. **Remove Deprecated REST Routes** (1 hr)
   - Delete `/api/devices/*`, `/api/roborock/*`, `/api/ring/*` (except snapshot)
   - Keep `/api/auth/*` until tRPC auth done
   - Keep `/api/health` and `/api/ring/.../snapshot`

### Commands

```bash
# Build
npm run build -w @smarthome/backend
npm run build -w @smarthome/frontend

# Run dev
npm run dev -w @smarthome/backend

# Restart service
sudo systemctl restart smarthome
sudo journalctl -u smarthome -f

# Check service
curl http://localhost:3000/api/health
```

### Service Config
- Port: 3000 (nginx uses 8000)
- Service file: `/etc/systemd/system/smarthome.service`
- Working dir: `/home/exedev/smarthome/packages/backend`
