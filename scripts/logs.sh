#!/bin/bash
# Follow logs for the smarthome systemd service

SERVICE_NAME="smarthome"
LINES=${1:-50}

echo "=== $SERVICE_NAME Service Logs (last $LINES lines, following) ==="
echo "Press Ctrl+C to stop"
echo ""

journalctl -u "$SERVICE_NAME" -n "$LINES" -f
