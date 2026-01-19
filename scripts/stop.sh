#!/bin/bash
# Stop the smarthome systemd service

SERVICE_NAME="smarthome"

echo "Stopping $SERVICE_NAME service..."

if ! systemctl list-unit-files | grep -q "$SERVICE_NAME.service"; then
    echo "Error: $SERVICE_NAME.service not found"
    exit 1
fi

sudo systemctl stop "$SERVICE_NAME"

if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✗ Failed to stop $SERVICE_NAME service"
    exit 1
else
    echo "✓ $SERVICE_NAME service stopped"
fi
