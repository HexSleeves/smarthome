# Smart Home Dashboard

A unified, modern web dashboard for controlling **Roborock** vacuums and **Ring** doorbells/cameras. Built with performance and user experience in mind, featuring a reactive UI, real-time updates, and low-latency video streaming.

## ✨ Features

### 🧹 Roborock Integration

Direct integration with Roborock Cloud API (no cloud-free rooting required).

- **Full Control**: Start, stop, pause, return to dock, and "find my robot".
- **Customization**: Adjust fan speed (Quiet/Balanced/Turbo/Max) and water level (Off/Low/Medium/High).
- **Real-time Status**: Live monitoring of battery level, cleaning area, duration, and error states.
- **Smart Auth**: Supports 2FA login flows directly from the dashboard.
- **Robust Control**: Uses a Python bridge for reliable MQTT communication.

### 🔔 Ring Integration

- **Live Streaming**: **HLS-based low-latency video streaming** for supported cameras.
- **Snapshots**: High-quality camera snapshots on demand.
- **Events**: Real-time notifications for motion and doorbell presses.
- **Controls**: Toggle lights and siren (if supported).
- **History**: View recent event history.

### 💻 Dashboard Experience

- **Unified View**: See all your devices in one responsive grid.
- **Dark Mode**: System-aware light/dark mode toggle.
- **Responsive**: Fully optimized for desktop and mobile devices.
- **Secure**: JWT-based authentication with role-based access control (Admin/Viewer).

## 🛠️ Tech Stack

This project is a **monorepo** managed with **Bun** workspaces.

### Frontend (`packages/frontend`)

- **Framework**: [React 19](https://react.dev/) with [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)
- **State/Data**: [TanStack Query](https://tanstack.com/query) & [Zustand](https://github.com/pmndrs/zustand)
- **API Client**: [tRPC](https://trpc.io/) (End-to-end type safety)
- **Video**: [hls.js](https://github.com/video-dev/hls.js) for streaming

### Backend (`packages/backend`)

- **Server**: [Fastify](https://fastify.dev/) (Node.js)
- **Database**: SQLite ([better-sqlite3](https://github.com/WiseLibs/better-sqlite3))
- **API**: [tRPC](https://trpc.io/) & WebSocket
- **Device APIs**:
  - `ring-client-api` for Ring
  - **Python Bridge**: `python-roborock` script for MQTT-based device control
- **Video Processing**: `ffmpeg` for HLS transcoding

### Shared (`packages/shared`)

- **Types**: Shared TypeScript interfaces/types for API and WebSocket payloads.

### Tooling

- **Package Manager**: [Bun](https://bun.sh/)
- **Linter/Formatter**: [Biome](https://biomejs.dev/)
- **Testing**: [Vitest](https://vitest.dev/)

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v20+) & **Bun** (v1.0+)
- **Python 3.10+** (Required for Roborock bridge)
- **FFmpeg** (Required for Ring live streaming)

### Installation

1. **Clone and Install**

   ```bash
   git clone <repo-url>
   cd smarthome
   bun install
   ```

2. **Python Environment Setup**
   The backend uses a Python virtual environment for the Roborock bridge.

   ```bash
   cd packages/backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install python-roborock paho-mqtt
   cd ../..
   ```

3. **Environment Setup**
   Copy the example environment file to the backend package:

   ```bash
   cp .env.example packages/backend/.env
   ```

   Edit `packages/backend/.env` with your secrets and preferences. Ensure `PORT` matches your expected configuration (default 3000, proxied to 8000).

4. **Start Development**

   ```bash
   # Starts both backend and frontend in development mode
   npm run dev
   ```

   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:8000` (via Proxy/Nginx) or `http://localhost:3000` (Direct)

### Production

```bash
# Build both packages
npm run build

# Start the production backend (serves frontend static files if configured)
npm start
```

## 📜 Scripts

Helper scripts are located in the `scripts/` directory for managing the application service:

- `./scripts/start.sh`: Start the application
- `./scripts/stop.sh`: Stop the application
- `./scripts/restart.sh`: Restart
- `./scripts/logs.sh`: View application logs
- `./scripts/status.sh`: Check service status

## 🚧 Status & Roadmap

This project is in active development.

- ✅ **Core Features**: Auth, Device Listing, Basic Controls, HLS Streaming.
- 🚧 **In Progress**: Production hardening, Secret rotation.
- 🔮 **Planned**: Roborock map visualization, Vacuum scheduling.

See [IMPROVEMENTS.md](./IMPROVEMENTS.md) for a detailed to-do list and [NEXT_AGENT.md](./NEXT_AGENT.md) for recent architectural updates.

## 📄 License

MIT
