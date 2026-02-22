#!/bin/bash
# =============================================================================
# DevPilot Service Installer
#
# Usage:
#   bash install_service.sh              Install and start DevPilot Auth
#   bash install_service.sh install      Install and start DevPilot Auth
#   bash install_service.sh remove       Remove service
#   bash install_service.sh status       Check status
#
# Note: AI Gateway is now an external service (https://oc.xbot.cool).
#       The local clawapi service is no longer needed.
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
header(){ echo -e "\n${CYAN}=== $* ===${NC}"; }

[ "$(id -u)" -eq 0 ] || error "Run as root"

# ---------------------------------------------------------------------------
# DevPilot Auth
# ---------------------------------------------------------------------------

DP_DIR="/opt/devpilot"
DP_AUTH_DIR="${DP_DIR}/auth"
DP_SERVICE="devpilot-auth"

install_devpilot() {
    header "Installing DevPilot Auth service"

    [ -d "$DP_AUTH_DIR" ] || error "$DP_AUTH_DIR not found"
    [ -f "$DP_AUTH_DIR/main.py" ] || error "$DP_AUTH_DIR/main.py not found"

    # Find .env (could be in auth/ or devpilot/)
    DP_ENV=""
    if [ -f "$DP_AUTH_DIR/.env" ]; then
        DP_ENV="$DP_AUTH_DIR/.env"
    elif [ -f "$DP_DIR/.env" ]; then
        DP_ENV="$DP_DIR/.env"
    else
        error "No .env found in $DP_AUTH_DIR or $DP_DIR"
    fi

    # Find venv
    DP_VENV=""
    if [ -f "$DP_AUTH_DIR/.venv/bin/uvicorn" ]; then
        DP_VENV="$DP_AUTH_DIR/.venv"
    elif [ -f "$DP_DIR/.venv/bin/uvicorn" ]; then
        DP_VENV="$DP_DIR/.venv"
    else
        error "No .venv with uvicorn found in $DP_AUTH_DIR or $DP_DIR"
    fi

    DP_PORT=$(grep -E "^AUTH_PORT=" "$DP_ENV" 2>/dev/null | cut -d= -f2 | tr -d ' "'"'" || true)
    [ -z "$DP_PORT" ] && DP_PORT=16001

    DP_WORKERS=$(grep -E "^AUTH_WORKERS=" "$DP_ENV" 2>/dev/null | cut -d= -f2 | tr -d ' "'"'" || true)
    [ -z "$DP_WORKERS" ] && DP_WORKERS=2

    cat > /etc/systemd/system/${DP_SERVICE}.service << EOF
[Unit]
Description=DevPilot Auth Service
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=${DP_AUTH_DIR}
EnvironmentFile=${DP_ENV}
ExecStart=${DP_VENV}/bin/uvicorn main:app --host 127.0.0.1 --port ${DP_PORT} --workers ${DP_WORKERS} --log-level info
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${DP_SERVICE}

NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${DP_AUTH_DIR}/data ${DP_DIR}/data

[Install]
WantedBy=multi-user.target
EOF

    # Kill existing process on port
    PID=$(lsof -ti :"$DP_PORT" 2>/dev/null || true)
    [ -n "$PID" ] && { warn "Killing process on port $DP_PORT (PID: $PID)"; kill "$PID" 2>/dev/null || true; sleep 1; }

    systemctl daemon-reload
    systemctl enable "$DP_SERVICE"
    systemctl start "$DP_SERVICE"
    sleep 2

    if systemctl is-active --quiet "$DP_SERVICE"; then
        info "DevPilot Auth started on port ${DP_PORT} (${DP_WORKERS} workers)"
    else
        warn "DevPilot Auth failed to start. Check: journalctl -u ${DP_SERVICE} -n 20"
    fi

    # Check for legacy clawapi service and warn
    if [ -f "/etc/systemd/system/clawapi.service" ]; then
        warn "Legacy clawapi.service detected. AI Gateway is now external."
        warn "To remove: systemctl disable clawapi && systemctl stop clawapi && rm /etc/systemd/system/clawapi.service"
    fi
}

# ---------------------------------------------------------------------------
# Remove
# ---------------------------------------------------------------------------

do_remove() {
    header "Removing services"
    for svc in "$DP_SERVICE"; do
        if [ -f "/etc/systemd/system/${svc}.service" ]; then
            systemctl stop "$svc" 2>/dev/null || true
            systemctl disable "$svc" 2>/dev/null || true
            rm -f "/etc/systemd/system/${svc}.service"
            info "Removed $svc"
        fi
    done
    systemctl daemon-reload
}

# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

do_status() {
    header "Service Status"
    echo ""
    for svc in "$DP_SERVICE"; do
        if [ -f "/etc/systemd/system/${svc}.service" ]; then
            STATUS=$(systemctl is-active "$svc" 2>/dev/null || echo "inactive")
            ENABLED=$(systemctl is-enabled "$svc" 2>/dev/null || echo "disabled")
            if [ "$STATUS" = "active" ]; then
                echo -e "  ${GREEN}●${NC} ${svc}  active (${ENABLED})"
            else
                echo -e "  ${RED}●${NC} ${svc}  ${STATUS} (${ENABLED})"
            fi
        else
            echo -e "  ${YELLOW}○${NC} ${svc}  not installed"
        fi
    done
    echo ""
    echo "Commands:"
    echo "  journalctl -u devpilot-auth -f   # Auth logs"
    echo "  systemctl restart devpilot-auth   # Restart Auth"
    echo ""
    echo "AI Gateway: https://oc.xbot.cool (external service, no local management needed)"
    echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

case "${1:-install}" in
    all|install)
        install_devpilot
        echo ""
        do_status
        ;;
    devpilot)   install_devpilot ;;
    remove)     do_remove ;;
    status)     do_status ;;
    *)
        echo "Usage: bash $0 [install|remove|status]"
        ;;
esac
