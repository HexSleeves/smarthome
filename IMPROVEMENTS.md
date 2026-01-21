# Smart Home Dashboard - Potential Improvements

## ✅ Completed Features

### Core Features

- **Authentication** - JWT-based auth with register/login/refresh
- **Roborock Integration** - Full control (start, stop, pause, dock, fan speed, water level)
- **Ring Integration** - Device listing, snapshots, HLS live streaming, event notifications
- **Real-time Updates** - WebSocket connection for live device state changes
- **Role-based Access** - Admin vs Viewer permissions
- **Dark Mode** - Three-way toggle (light/dark/system)

### DevOps

- Systemd service configuration
- Management scripts (start/stop/restart/logs/status/install)
- **Unit Testing Infrastructure** - Vitest configured for Backend

---

## 🔴 High Priority

### 1. Production Environment

Current `.env` has placeholder secrets; needs real secrets for production.

**Tasks:**

- [ ] Generate secure random secrets for JWT_SECRET, COOKIE_SECRET, ENCRYPTION_SECRET
- [ ] Document secret rotation procedure
- [ ] Add environment validation on startup

### 2. HTTPS/TLS

Backend runs on HTTP; exe.dev proxy provides HTTPS but direct access would need certs.

**Tasks:**

- [ ] Add TLS support to Fastify
- [ ] Document certificate setup (Let's Encrypt)
- [ ] Add HSTS headers

### 3. Database Migrations

No formal migration system; schema changes would need manual handling.

**Tasks:**

- [ ] Add migration framework (e.g., `better-sqlite3-migrations` or custom)
- [ ] Create migration for existing schema
- [ ] Add migration CLI command

---

## 🟡 Medium Priority

### 4. User Management UI

No way to manage users (change password, add users, change roles) from the UI.

**Tasks:**

- [ ] Add "Change Password" form in Settings
- [ ] Admin panel for user management
- [ ] Invite user flow
- [ ] Delete account option

### 5. Error Boundaries

React error boundaries for graceful error handling.

**Tasks:**

- [ ] Add ErrorBoundary component
- [ ] Wrap routes with error boundaries
- [ ] Add fallback UI for errors
- [ ] Log errors to console/server

### 6. Loading States

Some components could use skeleton loaders.

**Tasks:**

- [ ] Add Skeleton components to device cards
- [ ] Skeleton for settings forms while loading status
- [ ] Suspense boundaries for lazy-loaded routes

### 7. Push Notifications

Browser notifications for doorbell/motion events.

**Tasks:**

- [ ] Request notification permission
- [ ] Send browser notifications on ring:ding and ring:motion events
- [ ] Add notification preferences in Settings
- [ ] Optional: Service worker for background notifications

### 8. Ring 2FA Pending State

Better UX when 2FA is pending from a previous session.

**Tasks:**

- [ ] Show clear indicator when 2FA is pending
- [ ] Allow canceling pending 2FA
- [ ] Auto-detect pending 2FA on page load

### 9. Python Bridge Maintenance

Ensure the Roborock Python bridge is robust.

**Tasks:**

- [ ] Add error handling for python process crashes
- [ ] Auto-restart python subprocess if it dies
- [ ] Add logging for python script output

---

## 🟢 Nice to Have

### 10. Roborock Map Visualization

Display vacuum cleaning maps.

**Tasks:**

- [ ] Research Roborock map API format
- [ ] Add canvas/SVG map renderer
- [ ] Show real-time vacuum position
- [ ] Display room boundaries

### 11. Vacuum Scheduling

Set cleaning schedules.

**Tasks:**

- [ ] Add schedule CRUD endpoints
- [ ] Schedule UI with time picker
- [ ] Per-room scheduling
- [ ] Recurring schedule support

### 12. Ring Video History

Playback of recorded events.

**Tasks:**

- [ ] Fetch event recordings from Ring API
- [ ] Video player component
- [ ] Event timeline view
- [ ] Download option

### 13. Multi-user Support

Multiple households/locations.

**Tasks:**

- [ ] Add "homes" or "locations" concept
- [ ] Share devices between users
- [ ] Per-home device credentials

### 14. Mobile App

PWA or React Native version.

**Tasks:**

- [ ] Add PWA manifest
- [ ] Service worker for offline support
- [ ] Add to home screen prompt
- [ ] Or: React Native app with shared types

### 15. Unit Tests

Expand test coverage.

**Tasks:**

- [x] Set up Vitest for backend
- [ ] Set up Vitest for frontend
- [ ] Test auth flows
- [ ] Test tRPC procedures
- [ ] Test React components

### 16. E2E Tests

Playwright or Cypress tests.

**Tasks:**

- [ ] Set up Playwright
- [ ] Test login/register flow
- [ ] Test device control flows
- [ ] CI integration

### 17. API Documentation

OpenAPI/Swagger docs.

**Tasks:**

- [ ] Add @fastify/swagger
- [ ] Document all REST endpoints
- [ ] Add request/response examples
- [ ] Host docs at /api/docs

### 18. Localization

i18n support for multiple languages.

**Tasks:**

- [ ] Add react-i18next
- [ ] Extract all strings to translation files
- [ ] Add language picker in Settings
- [ ] Support: English, Spanish, etc.

---

## 🔧 Code Quality

### 19. Error Logging

Centralized error tracking.

**Tasks:**

- [ ] Integrate Sentry or similar
- [ ] Add error context (user, device)
- [ ] Set up alerts for critical errors

### 20. Rate Limiting

Protect API from abuse.

**Tasks:**

- [ ] Add @fastify/rate-limit
- [ ] Configure limits per endpoint
- [ ] Add rate limit headers
- [ ] Exempt authenticated users (higher limits)

### 21. Input Validation

More robust Zod schemas.

**Tasks:**

- [ ] Review all tRPC inputs
- [ ] Add max length limits
- [ ] Sanitize HTML in user inputs
- [ ] Add custom error messages

### 22. Code Splitting

Lazy load routes to reduce bundle size (currently 1MB+).

**Tasks:**

- [ ] Use React.lazy() for route components
- [ ] Add loading fallbacks
- [ ] Split vendor chunks
- [ ] Analyze bundle with vite-bundle-visualizer

---

## Quick Wins

Easiest improvements to implement:

1. **Error Boundaries** - ~30 min
2. **PWA Manifest** - ~15 min
3. **Rate Limiting** - ~30 min
4. **Change Password Form** - ~1 hour
5. **Browser Notifications** - ~1 hour

---

## Architecture Decisions to Consider

### Database

- Current: SQLite (single file, good for small scale)
- Consider: PostgreSQL if scaling to multiple instances

### Caching

- Current: None
- Consider: Redis for session storage, device state caching

### Deployment

- Current: Single server with systemd
- Consider: Docker for easier deployment, Kubernetes for scaling

### Monitoring

- Current: journalctl logs only
- Consider: Prometheus metrics, Grafana dashboards
