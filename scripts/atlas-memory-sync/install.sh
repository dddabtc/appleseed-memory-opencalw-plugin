#!/usr/bin/env bash
# Install atlas-memory-sync as a systemd service.
#
# Watches configured directories for .md file changes and syncs
# them into Atlas Memory via the /memories REST API.
#
# Usage (as root):
#   bash install.sh
set -euo pipefail

INSTALL_DIR="/root/.openclaw/atlas-memory-sync"
SERVICE_SRC="$(dirname "$(readlink -f "$0")")/atlas-memory-sync.service"
SYNC_SRC="$(dirname "$(readlink -f "$0")")/sync.py"

mkdir -p "$INSTALL_DIR"
cp "$SYNC_SRC" "$INSTALL_DIR/sync.py"
chmod +x "$INSTALL_DIR/sync.py"

cp "$SERVICE_SRC" /etc/systemd/system/atlas-memory-sync.service

# Ensure watchdog is available
python3 -c "import watchdog" 2>/dev/null || pip install watchdog requests

systemctl daemon-reload
systemctl enable atlas-memory-sync
systemctl restart atlas-memory-sync
sleep 2
systemctl status atlas-memory-sync --no-pager | head -15
