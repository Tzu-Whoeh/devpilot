# 🛠️ DevPilot 开发环境与技术规范

> 最后更新: 2026-02-22

## 1. 代码仓库

- **GitHub**: https://github.com/Tzu-Whoeh/devpilot

## 2. 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.11 + FastAPI + SQLAlchemy |
| 前端 | HTML + CSS + Vanilla JS |
| 数据库 | PostgreSQL |
| 认证 | JWT (RS256) |
| AI 能力 | AI Gateway (https://oc.xbot.cool) |

## 3. 目录结构

```
devpilot/
├── auth/              # Auth Service (FastAPI)
│   ├── main.py        # 主程序
│   └── migrations/    # Alembic 迁移
├── frontend/          # 前端静态页面
│   ├── index.html
│   ├── css/
│   └── js/
├── keys/              # JWT 密钥对
├── nginx/             # Nginx 配置
└── scripts/           # 工具脚本
```

## 4. 部署架构

```
p.xbot.cool:443 (Nginx)
  ├── /           → Frontend (静态)
  ├── /auth/*    → Auth Service (127.0.0.1:16001)
  ├── /projects/* → Auth Service
  └── /ai/*      → Auth Service

oc.xbot.cool → AI Gateway (外部 AI 服务)
```

## 5. 本地开发

### 5.1 环境要求
- Python 3.11+
- Git
- PostgreSQL

### 5.2 克隆代码
```bash
git clone https://github.com/Tzu-Whoeh/devpilot.git
cd devpilot
```

### 5.3 安装依赖
```bash
pip install fastapi uvicorn sqlalchemy asyncpg pydantic PyJWT bcrypt structlog slowapi python-multipart alembic
```

### 5.4 环境变量
```bash
# 创建 .env 文件
AUTH_DATABASE_URL=postgresql+asyncpg://devpilot:devpilot123@localhost/devpilot
JWT_PRIVATE_KEY_FILE=./keys/jwt_private.pem
JWT_PUBLIC_KEY_FILE=./keys/jwt_public.pem
AI_GATEWAY_URL=https://oc.xbot.cool
AI_GATEWAY_KEY=your-api-key
```

### 5.5 启动服务
```bash
cd auth
python -m uvicorn main:app --host 127.0.0.1 --port 16001 --reload
```

### 5.6 运行迁移
```bash
cd auth
alembic upgrade head
```

### 5.7 API 文档
启动后访问: http://127.0.0.1:16001/docs

## 6. Phase 1 任务清单

| 任务 ID | 内容 | 状态 |
|---------|------|------|
| P1-W1-01 | PostgreSQL + Alembic 迁移 | ✅ 已完成 |
| P1-W1-02 | users 表 + JWT 验证 | ✅ 已完成 |
| P1-W1-03 | projects 基础 CRUD | ✅ 已完成 |
| P1-W1-04 | AI Router (意图解析) | ✅ 已完成 |
| P1-W1-05 | 上下文组装器 | ✅ 已完成 |
| P1-W1-06 | 增强对话入口 | ✅ 已完成 |

## 7. API 端点

### 7.1 认证
- `POST /auth/register` - 注册
- `POST /auth/login` - 登录
- `POST /auth/change-password` - 修改密码
- `GET /auth/me` - 当前用户

### 7.2 项目
- `GET /projects` - 列表
- `POST /projects` - 创建
- `GET /projects/{id}` - 详情
- `DELETE /projects/{id}` - 删除

### 7.3 AI
- `POST /ai/route` - 意图解析
- `POST /ai/context` - 获取上下文
- `POST /ai/chat` - AI 对话
