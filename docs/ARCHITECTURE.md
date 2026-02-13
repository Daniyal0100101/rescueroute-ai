# Architecture Guide

## System Overview
RescueRoute AI has three runtime services:
- `simulation` (FastAPI, port 8001): disaster robot simulator and mission engine
- `backend` (FastAPI, port 8000): polling bridge, SSE stream, AI decision endpoint
- `frontend` (Next.js, port 3000): live operations dashboard

## Data Flow
1. Simulator advances robot/mission state every second.
2. Backend polls `GET /simulation/state` every second.
3. Backend normalizes simulator payload into frontend-friendly schema.
4. Frontend subscribes to `GET /api/v1/stream` (SSE) for live updates.
5. User-triggered AI decisions call `POST /api/v1/ai/decide`.

## API Endpoints

### Simulation API (Port 8001)
- `GET /` health check
- `GET /simulation/state` live state snapshot
- `POST /simulation/reset` resets simulator

### Backend API (Port 8000)
- `GET /` backend health + configured simulator URL
- `GET /api/v1/stream` SSE stream of normalized simulation state
- `GET /api/v1/state` latest normalized snapshot
- `GET /api/v1/robots` robots list
- `GET /api/v1/missions` active/pending mission list
- `GET /api/v1/metrics` derived metrics and simulator aggregates
- `POST /api/v1/ai/decide` Gemini-backed command recommendation

## Reliability Notes
- Frontend reconnects SSE automatically on disconnect.
- Backend polling failures are logged and retried.
- Initial dashboard load may be empty briefly until first simulator poll succeeds.

## Security Notes
- CORS uses allowlisted origins (`FRONTEND_ORIGINS`) instead of wildcard defaults.
- Secrets loaded from environment only (`.env`).
- AI log writes are non-fatal; failed log writes do not crash request handling.
