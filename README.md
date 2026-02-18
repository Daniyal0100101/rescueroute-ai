# RescueRoute AI

Autonomous disaster response operations platform with live simulation, backend orchestration, and AI-assisted mission decisions.

## Services
- Frontend dashboard: `http://localhost:3000`
- Backend API + SSE: `http://localhost:8000`
- Simulation service: `http://localhost:8001`

## Quick Start

### Recommended: Docker Compose (dev)

```bash
docker compose up --build
```

Services will be available at:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- Simulator: `http://localhost:8001`

The frontend uses `NEXT_PUBLIC_API_BASE_URL` (set in `docker-compose.yml`) and will call `http://localhost` as the base URL. In local dev without a reverse proxy, you can override this (see Environment variables).

### Alternative: Manual setup

#### 1. Start simulation
```bash
cd simulation
pip install -r requirements.txt
uvicorn simulator:app --host 0.0.0.0 --port 8001 --reload
```

#### 2. Start backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
```

#### 3. Start frontend
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Expected startup behavior
- The dashboard may show loading for a few seconds while backend SSE connects.
- Movement appears after backend receives simulator snapshots (polled every second by default).
- If you see `Stream disconnected`, verify simulator is running on port `8001` and backend on `8000`.

## Environment variables

### Backend
- `SIMULATOR_BASE_URL` (default `http://127.0.0.1:8001`)
- `SIM_POLL_INTERVAL_SECONDS` (default `1.0`)
- `SIM_GRID_SIZE` (default `50`)
- `FRONTEND_ORIGINS` (comma-separated CORS allowlist; defaults to localhost dev origins)
- `GEMINI_API_KEY` (required for AI decisions via `POST /api/v1/ai/decide`)

### Frontend
- `NEXT_PUBLIC_API_BASE_URL` (default `http://127.0.0.1:8000`)

For deployments where the frontend should route to a reverse proxy host (recommended), set:
- `NEXT_PUBLIC_API_BASE_URL=http://YOUR_IP` (or your domain)

If you are running without a reverse proxy and want the frontend to call the backend directly, set:
- `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`

## Deployment notes

Live deployment at `http://45.76.69.45` uses an external Nginx reverse proxy on the server (not included in this repository). Nginx is responsible for routing requests to the frontend and backend services.

## Security notes
- CORS is allowlisted via `FRONTEND_ORIGINS` rather than wildcard defaults.
- AI decision logs are written to `backend/logs/ai_decisions.jsonl`.
- Do not commit `.env` or API keys.

## Documentation
- Architecture: `docs/ARCHITECTURE.md`
- Backend details: `backend/README.md`
- Frontend details: `frontend/README.md`

Core system is built by Daniyal Asif (full-stack, AI integration, simulation engine, frontend dashboard, deployment) With ❤️
