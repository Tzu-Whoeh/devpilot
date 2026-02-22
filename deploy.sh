#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  DevPilot — 前端 + Auth 服务部署
#
#  前提: ClawAPI 已部署并获取 API Key
#
#  用法: sudo bash deploy.sh
# ═══════════════════════════════════════════════════════════
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="/opt/devpilot"
AUTH_PORT=16001

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC}   $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
info() { echo -e "${CYAN}[INFO]${NC} $*"; }

echo ""
echo "================================================="
echo "         DevPilot — 前端 + Auth 部署"
echo "================================================="
echo ""

command -v python3 >/dev/null || { echo "ERROR: python3 required"; exit 1; }

# ═══════════════════════════════════════════════
# 1. 复制文件
# ═══════════════════════════════════════════════
echo ""
echo "--- [1/5] 复制文件 ---"

mkdir -p "$INSTALL_DIR"/{auth,frontend,keys,data}
cp -a "$SCRIPT_DIR/auth/"* "$INSTALL_DIR/auth/"
cp -a "$SCRIPT_DIR/frontend/"* "$INSTALL_DIR/frontend/"
ok "文件已复制 -> $INSTALL_DIR"

# ═══════════════════════════════════════════════
# 2. 生成 RSA 密钥对
# ═══════════════════════════════════════════════
echo ""
echo "--- [2/5] RSA 密钥 ---"

PRIV_KEY="$INSTALL_DIR/keys/jwt_private.pem"
PUB_KEY="$INSTALL_DIR/keys/jwt_public.pem"

if [ -f "$PRIV_KEY" ]; then
    ok "密钥已存在，跳过生成"
else
    python3 -c "
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
with open('$PRIV_KEY', 'wb') as f:
    f.write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
with open('$PUB_KEY', 'wb') as f:
    f.write(key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo))
"
    chmod 600 "$PRIV_KEY"
    ok "RSA 密钥对已生成"
fi

# ═══════════════════════════════════════════════
# 3. 配置
# ═══════════════════════════════════════════════
echo ""
echo "--- [3/5] 配置 ---"

ENV_FILE="$INSTALL_DIR/auth/.env"
if [ ! -f "$ENV_FILE" ]; then
    cp "$SCRIPT_DIR/shared.env.example" "$ENV_FILE"
    # Set key paths
    sed -i "s|JWT_PRIVATE_KEY_FILE=.*|JWT_PRIVATE_KEY_FILE=$PRIV_KEY|" "$ENV_FILE"
    sed -i "s|JWT_PUBLIC_KEY_FILE=.*|JWT_PUBLIC_KEY_FILE=$PUB_KEY|" "$ENV_FILE"
    ok "已生成 $ENV_FILE"
    warn ">>> 请编辑 $ENV_FILE 设置 CLAWAPI_KEY <<<"
else
    ok ".env 已存在"
fi

# ═══════════════════════════════════════════════
# 4. Python 依赖
# ═══════════════════════════════════════════════
echo ""
echo "--- [4/5] Python 依赖 ---"
cd "$INSTALL_DIR/auth"

if [ ! -d .venv ]; then
    python3 -m venv .venv
fi
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q fastapi "uvicorn[standard]" pydantic structlog slowapi \
    httpx bcrypt PyJWT cryptography aiosqlite sqlalchemy
ok "依赖安装完成"

# ═══════════════════════════════════════════════
# 5. Nginx + systemd
# ═══════════════════════════════════════════════
echo ""
echo "--- [5/5] 服务配置 ---"

# Auth systemd service
cat > /etc/systemd/system/devpilot-auth.service <<EOF
[Unit]
Description=DevPilot Auth Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/auth
EnvironmentFile=$INSTALL_DIR/auth/.env
ExecStart=$INSTALL_DIR/auth/.venv/bin/uvicorn main:app --host 127.0.0.1 --port $AUTH_PORT
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=devpilot-auth

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable devpilot-auth
ok "devpilot-auth.service 已注册"

# Nginx
if command -v nginx >/dev/null; then
    cp "$SCRIPT_DIR/nginx/devpilot.conf" /etc/nginx/conf.d/ 2>/dev/null || \
    cp "$SCRIPT_DIR/nginx/devpilot.conf" /etc/nginx/sites-enabled/ 2>/dev/null
    nginx -t && systemctl reload nginx
    ok "Nginx 已配置"
else
    warn "Nginx 未安装 — 请手动配置"
    info "配置文件: $SCRIPT_DIR/nginx/devpilot.conf"
fi

# ═══════════════════════════════════════════════
# 完成
# ═══════════════════════════════════════════════
echo ""
echo "================================================="
echo "           DevPilot 安装完成"
echo "================================================="
echo ""
echo "  安装目录:  $INSTALL_DIR"
echo "  Auth配置:  $INSTALL_DIR/auth/.env"
echo ""
echo "  接下来:"
echo ""
echo "    1. 确保 ClawAPI 已运行，获取 API Key"
echo ""
echo "    2. 编辑配置:"
echo "       vi $INSTALL_DIR/auth/.env"
echo "       # 设置 CLAWAPI_KEY=sk-xxx"
echo ""
echo "    3. 启动 Auth Service:"
echo "       systemctl start devpilot-auth"
echo ""
echo "    4. 访问:"
echo "       https://oc.xbot.cool:8888"
echo ""
echo "  架构:"
echo "    浏览器 → Nginx:8888"
echo "            ├── /         → 前端"
echo "            ├── /auth/*   → Auth (JWT登录)"
echo "            └── /chat/*   → Auth (验JWT→注入APIKey→ClawAPI)"
echo ""
