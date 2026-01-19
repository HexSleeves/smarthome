# Smart Home Dashboard

A unified web dashboard for controlling Roborock vacuum and Ring doorbell devices.

## Features

- **Unified Dashboard**: View all connected devices in one place
- **Roborock Vacuum Control**:
  - Start, stop, pause, and dock commands
  - Fan speed and water level adjustment
  - Battery and cleaning status
  - Real-time status updates
- **Ring Doorbell**:
  - Live camera snapshots
  - Motion and doorbell event notifications
  - Event history
  - Light and siren controls
- **User Management**:
  - Secure JWT authentication
  - Role-based access (admin/viewer)
  - Encrypted device credentials

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Query
- **Backend**: Node.js, Fastify, SQLite, WebSocket
- **Device APIs**: ring-client-api (unofficial), Roborock Cloud API

## Quick Start

```bash
# Install dependencies
npm install

# Start development servers
npm run dev

# Or start production build
npm run build
npm start
```

## Environment Variables

Copy `.env.example` to `packages/backend/.env` and configure:

```
PORT=8000
JWT_SECRET=your-secret-key
ENCRYPTION_SECRET=your-encryption-key
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Get current user

### Devices

- `GET /api/devices` - List all devices
- `GET /api/devices/:id` - Get device details
- `GET /api/devices/:id/events` - Get device events

### Roborock

- `GET /api/roborock/status` - Connection status
- `POST /api/roborock/auth` - Authenticate
- `GET /api/roborock/devices` - List vacuums
- `POST /api/roborock/devices/:id/command` - Send command

### Ring

- `GET /api/ring/status` - Connection status
- `POST /api/ring/auth` - Authenticate (supports 2FA)
- `GET /api/ring/devices` - List cameras
- `GET /api/ring/devices/:id/snapshot` - Get camera snapshot

### WebSocket

- `WS /api/ws/events?token=JWT` - Real-time events

## Architecture

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│    Browser     │◄────►│    Backend     │◄────►│  Cloud APIs    │
│  (React SPA)   │     │   (Fastify)    │     │  Roborock/Ring │
└────────────────┘     └────────────────┘     └────────────────┘
        │                    │
        │    WebSocket       │
        └────────────────────┘
```

## Security Notes

- Device credentials are encrypted at rest using AES-256-GCM
- JWT tokens expire after 15 minutes
- Refresh tokens expire after 7 days
- Admin role required for device commands
- All API calls require authentication

## Limitations

- Ring live video streaming requires WebRTC/SIP setup (snapshots provided as fallback)
- Roborock map visualization not implemented (API complexity)
- Unofficial APIs may change without notice

## License

MIT
