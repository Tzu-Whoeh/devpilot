# DevPilot 开发指南

> 📌 完整开发文档请查阅 Notion 项目空间:
> https://www.notion.so/DevPilot-1-0-30e0904afc7d800b983df26837d9ccd9

## 快速开始

1. 确保 Auth Service 运行: `cd auth && uvicorn main:app --port 16001`
2. 前端访问: `http://localhost:8888`（通过 Nginx）
3. Mock 模式下无需后端，直接打开 `frontend/index.html` 即可

## 技术栈

- **Auth Service** (:16001) — SQLite + FastAPI
- **PCC Core** (:16003) — PostgreSQL + FastAPI (Phase 1 开发中)
- **AI Gateway** (:16002) — AI 服务 (外部仓库)
- **Frontend** — Vanilla JS SPA

## 目录结构规范

详见 CODE-DEVPILOT-001 v1.0 (Notion)
