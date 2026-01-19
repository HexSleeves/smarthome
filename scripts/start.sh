#!/bin/bash
# Start the smarthome systemd service

SERVICE_NAME="smarthome"

echo "Starting $SERVICE_NAME service..."

if ! systemctl list-unit-files | grep -q "$SERVICE_NAME.service"; then
    echo "Error: $SERVICE_NAME.service not found"
    echo "Install it first with: sudo cp smarthome.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable smarthome"
    exit 1
fi

sudo systemctl start "$SERVICE_NAME"

sleep 2

if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✓ $SERVICE_NAME service started successfully"
else
    echo "✗ $SERVICE_NAME service failed to start"
    echo ""
    echo "Recent logs:"
    journalctl -u "$SERVICE_NAME" -n 20 --no-pager
    exit 1
fi
