# RescueRoute AI Backend

Backend service for state streaming, simulator integration, and AI decisions.

## Run
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
```

## Required companion service
Simulation service must be running at `SIMULATOR_BASE_URL` (default `http://127.0.0.1:8001`).

## Environment
- `SIMULATOR_BASE_URL=http://127.0.0.1:8001`
- `SIM_POLL_INTERVAL_SECONDS=1.0`
- `SIM_GRID_SIZE=50`
- `FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`
- `GEMINI_API_KEY=...` (optional for AI endpoint)

## Main endpoints
- `GET /api/v1/stream`
- `GET /api/v1/state`
- `GET /api/v1/metrics`
- `POST /api/v1/ai/decide`
