# CraftsmanAI monorepo

This repository contains the complete CraftsmanAI application:

- `frontend/` — Next.js web application
- `backend/` — FastAPI API, Celery workers, and scheduled jobs
- `deploy/` — production PM2 and Nginx templates for the Hostinger VPS

The production site uses one public origin, `https://craftsmanai.app`. Nginx sends API, Socket.IO, documentation, and fallback-upload traffic to FastAPI; all other requests go to Next.js.

## Local development

### Frontend

```bash
cd frontend
cp .env.example .env.local
pnpm install --frozen-lockfile
pnpm dev
```

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
mkdir -p logs uploads
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

On Windows PowerShell, activate the backend environment with `venv\Scripts\Activate.ps1`.

## Production deployment

Production currently runs on Ubuntu with Nginx, PM2, PostgreSQL 16, and Redis. See [`deploy/README.md`](deploy/README.md) before changing the live server. The deployment procedure deliberately preserves the existing PostgreSQL database, Redis data, Supabase Storage bucket, backend `.env`, and `backend/uploads/` fallback files.

## Validation

```bash
pnpm --dir frontend typecheck
pnpm --dir frontend test
python -m compileall backend/app
```
