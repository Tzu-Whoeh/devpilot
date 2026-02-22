#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  DevPilot Auth Service — 启动脚本
#
#  用法:
#    ./run.sh dev     开发模式 (热重载)
#    ./run.sh prod    生产模式
#    ./run.sh         默认生产模式
# ═══════════════════════════════════════════════════════════
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AUTH_DIR="$SCRIPT_DIR/auth"
PORT="${AUTH_PORT:-16001}"
HOST="${AUTH_HOST:-127.0.0.1}"

# Check if deployed to /opt/devpilot
if [ -d "/opt/devpilot/auth" ]; then
    AUTH_DIR="/opt/devpilot/auth"
fi

cd "$AUTH_DIR"

# Activate venv
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f "$SCRIPT_DIR/auth/.venv/bin/activate" ]; then
    source "$SCRIPT_DIR/auth/.venv/bin/activate"
else
    echo "ERROR: Python venv not found. Run deploy.sh first."
    exit 1
fi

# Load .env
if [ -f .env ]; then
    set -a; source .env; set +a
fi

MODE="${1:-prod}"

case "$MODE" in
    dev)
        echo "[INFO] Starting DevPilot Auth in development mode..."
        echo "       Auth API:  http://$HOST:$PORT"
        echo "       Health:    http://$HOST:$PORT/health"
        echo ""
        uvicorn main:app --host "$HOST" --port "$PORT" --reload --reload-dir .
        ;;
    prod)
        echo "[INFO] Starting DevPilot Auth in production mode..."
        echo "       Auth API:  http://$HOST:$PORT"
        echo "       Health:    http://$HOST:$PORT/health"
        echo ""
        uvicorn main:app --host "$HOST" --port "$PORT" --workers 2
        ;;
    *)
        echo "Usage: $0 {dev|prod}"
        exit 1
        ;;
esac
