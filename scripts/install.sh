#!/bin/bash
# Install/update the smarthome systemd service

set -e

SERVICE_NAME="smarthome"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Installing $SERVICE_NAME Service ==="
echo ""

# Check if service file exists
if [ ! -f "$PROJECT_DIR/smarthome.service" ]; then
    echo "Error: smarthome.service not found in $PROJECT_DIR"
    exit 1
fi

# Create log directory
echo "Creating log directory..."
sudo mkdir -p /var/log/smarthome
sudo chown exedev:exedev /var/log/smarthome

# Copy service file
echo "Installing service file..."
sudo cp "$PROJECT_DIR/smarthome.service" /etc/systemd/system/

# Reload systemd
echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

# Enable service
echo "Enabling service..."
sudo systemctl enable "$SERVICE_NAME"

echo ""
echo "✓ $SERVICE_NAME service installed successfully"
echo ""
echo "Commands:"
echo "  Start:   ./scripts/start.sh"
echo "  Stop:    ./scripts/stop.sh"
echo "  Restart: ./scripts/restart.sh"
echo "  Status:  ./scripts/status.sh"
echo "  Logs:    ./scripts/logs.sh"
