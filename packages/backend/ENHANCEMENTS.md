# Smart Home Backend – Enhancement Plan

> Generated from security/architecture review. Track progress here.

## Status Overview

| Phase | Status | Target |
|-------|--------|--------|
| Phase 1: Critical Security | 🟡 In Progress | Week 1 |
| Phase 2: Architecture Cleanup | ⬜ Not Started | Week 1-2 |
| Phase 3: Reliability & Observability | ⬜ Not Started | Week 2 |
| Phase 4: Testing | ⬜ Not Started | Ongoing |

---

## Phase 1: Critical Security (Priority: 🔴 CRITICAL)

### 1.1 Fail on Missing Secrets

- [x] Create `src/config.ts` with Zod validation
- [x] Require `JWT_SECRET`, `COOKIE_SECRET`, `ENCRYPTION_SECRET` (32+ chars)
- [x] Allow dev defaults only in non-production
- [x] Update all usages to import from config

### 1.2 Add Rate Limiting

- [x] Install `@fastify/rate-limit`
- [x] Global limit: 100 req/min
- [x] Auth endpoints: 10 req/min (stricter)

### 1.3 Add Security Headers

- [x] Install `@fastify/helmet`
- [x] Configure for SPA compatibility

### 1.4 Fix CORS

- [x] Replace `origin: true` with explicit whitelist
- [x] Use `CORS_ORIGIN` env var (comma-separated)
- [x] Block all origins in production if not configured

### 1.5 Add Graceful Shutdown

- [x] Handle SIGINT/SIGTERM
- [x] Close Fastify server
- [x] Add `shutdown()` methods to services
- [x] Close database connection

---

## Phase 2: Architecture Cleanup (Priority: 🟠 HIGH)

### 2.1 Remove Duplicate REST Routes

- [ ] Keep: `/api/auth/*` (until tRPC auth ready), `/api/health`, `/api/ring/devices/:id/snapshot`
- [ ] Remove: `/api/devices/*`, `/api/roborock/*`, `/api/ring/*` (except snapshot)
- [ ] Update frontend to use tRPC exclusively

### 2.2 Fix Service Encapsulation

- [ ] Add `getDeviceState(deviceId)` public method to services
- [ ] Remove `service['deviceStates']` private access in tRPC routers
- [ ] Add `getAllDeviceStates(userId)` for batch access

### 2.3 Migrate Auth to tRPC

- [ ] Create `src/trpc/routers/auth.ts`
- [ ] Implement: `register`, `login`, `refresh`, `logout`, `me`
- [ ] Add to appRouter
- [ ] Deprecate REST auth routes

### 2.4 Structured Logging

- [ ] Replace all `console.log/error` with `fastify.log.*`
- [ ] Pass logger to services
- [ ] Add request context to logs

---

## Phase 3: Reliability & Observability (Priority: 🟡 MEDIUM)

### 3.1 Add Fetch Timeouts

- [ ] Create `src/lib/fetch.ts` with timeout wrapper
- [ ] Default timeout: 30s for external APIs
- [ ] Use `AbortController` for cancellation

### 3.2 Add Request IDs

- [ ] Install/create request-id plugin
- [ ] Add `x-request-id` header to responses
- [ ] Include in all log entries

### 3.3 Hash Refresh Tokens

- [ ] Hash tokens before storing in DB
- [ ] Update session queries to compare hashes
- [ ] Migration for existing tokens (invalidate all)

### 3.4 Global Error Handler

- [ ] Create `src/plugins/errorHandler.ts`
- [ ] Map Zod errors to 400
- [ ] Map TRPCError to appropriate status
- [ ] Hide internal errors in production

---

## Phase 4: Testing (Priority: 🟡 MEDIUM)

### 4.1 Test Infrastructure

- [ ] Install Vitest
- [ ] Configure for TypeScript
- [ ] Add test scripts to package.json
- [ ] Set up test database

### 4.2 Unit Tests

- [ ] `src/lib/crypto.ts` - encrypt/decrypt round-trip
- [ ] `src/config.ts` - validation logic
- [ ] Service methods (mocked external APIs)

### 4.3 Integration Tests

- [ ] Auth flow: register → login → refresh → logout
- [ ] Protected routes require valid JWT
- [ ] Admin routes require admin role
- [ ] Rate limiting triggers at threshold

---

## Security Checklist

- [x] No hardcoded secrets in production
- [x] Rate limiting on all endpoints
- [x] Stricter rate limiting on auth endpoints
- [x] Security headers via Helmet
- [x] CORS restricted to known origins
- [ ] Refresh tokens hashed in database
- [ ] Input validation on all endpoints (via tRPC/Zod)
- [ ] No sensitive data in logs
- [ ] HTTPS enforced (handled by proxy)

---

## Files Changed

### Phase 1

- `src/config.ts` (new) - Environment validation
- `src/index.ts` - Plugin registration, shutdown handlers
- `src/services/roborock.ts` - Add shutdown method
- `src/services/ring.ts` - Add shutdown method
- `package.json` - New dependencies

### Phase 2 (planned)

- `src/trpc/routers/auth.ts` (new)
- `src/trpc/routers/index.ts` - Add auth router
- `src/routes/*.ts` - Remove deprecated routes
- `src/services/*.ts` - Add public getters

---

## Dependencies Added

```bash
# Phase 1
bun add @fastify/rate-limit @fastify/helmet
```

---

## Environment Variables

| Variable | Required | Default (dev only) | Description |
|----------|----------|-------------------|-------------|
| `NODE_ENV` | No | `development` | Environment mode |
| `PORT` | No | `8000` | Server port |
| `HOST` | No | `0.0.0.0` | Server host |
| `LOG_LEVEL` | No | `info` | Logging level |
| `JWT_SECRET` | **Yes (prod)** | dev default | JWT signing secret (32+ chars) |
| `COOKIE_SECRET` | **Yes (prod)** | dev default | Cookie signing secret (32+ chars) |
| `ENCRYPTION_SECRET` | **Yes (prod)** | dev default | Credential encryption key (32+ chars) |
| `CORS_ORIGIN` | No | `*` (dev) | Allowed origins (comma-separated) |
