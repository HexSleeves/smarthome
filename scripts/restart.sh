#!/bin/bash
# Restart the smarthome systemd service

set -e

SERVICE_NAME="smarthome"

echo "Restarting $SERVICE_NAME service..."

# Check if service exists
if ! systemctl list-unit-files | grep -q "$SERVICE_NAME.service"; then
    echo "Error: $SERVICE_NAME.service not found"
    echo "Install it first with: sudo cp smarthome.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable smarthome"
    exit 1
fi

# Restart the service
sudo systemctl restart "$SERVICE_NAME"

# Wait a moment for it to start
sleep 2

# Check status
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✓ $SERVICE_NAME service restarted successfully"
    echo ""
    echo "Status:"
    systemctl status "$SERVICE_NAME" --no-pager | head -15
else
    echo "✗ $SERVICE_NAME service failed to start"
    echo ""
    echo "Recent logs:"
    journalctl -u "$SERVICE_NAME" -n 20 --no-pager
    exit 1
fi
