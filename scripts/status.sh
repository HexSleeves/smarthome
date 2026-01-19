#!/bin/bash
# Show status of the smarthome systemd service

SERVICE_NAME="smarthome"

echo "=== $SERVICE_NAME Service Status ==="
echo ""

if ! systemctl list-unit-files | grep -q "$SERVICE_NAME.service"; then
    echo "Service not installed."
    exit 1
fi

systemctl status "$SERVICE_NAME" --no-pager
