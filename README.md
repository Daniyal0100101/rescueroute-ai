# RescueRoute AI

RescueRoute AI is an autonomous disaster-response operations platform that combines **live simulation**, **backend orchestration**, and **AI-assisted mission decisions** in a single system.

It is designed to show how intelligent software can coordinate emergency units, track changing field conditions, and support faster operational decisions through a real-time interface.

## Why this project matters
- Simulates disaster-response operations with moving units and live updates
- Uses a FastAPI backend to coordinate data flow, mission state, and AI decision support
- Streams operational changes to a frontend dashboard for real-time visibility
- Demonstrates how AI can assist human operators in high-pressure environments

## Core capabilities
- **Live simulation** of disaster-response activity on a dynamic grid
- **Backend orchestration** for mission state, system coordination, and event flow
- **AI-assisted decision support** using Gemini for mission recommendations
- **Real-time dashboard** for monitoring units and system behavior
- **SSE-based updates** for responsive front-end state changes

## Architecture
- **Frontend:** Next.js dashboard
- **Backend:** FastAPI API + SSE stream
- **Simulation service:** FastAPI-based simulator
- **AI layer:** Gemini-powered decision support

## Services
- Frontend dashboard: `http://localhost:3000`
- Backend API + SSE: `http://localhost:8000`
- Simulation service: `http://localhost:8001`

## Quick Start

### Recommended: Docker Compose

```bash
docker compose up --build
```

Then open:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- Simulator: `http://localhost:8001`

### Manual setup

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
- The dashboard may show loading briefly while the SSE connection initializes
- Movement appears after the backend receives simulator snapshots
- If you see `Stream disconnected`, confirm the simulator is running on port `8001` and the backend on `8000`

## Environment variables

### Backend
- `SIMULATOR_BASE_URL` (default `http://127.0.0.1:8001`)
- `SIM_POLL_INTERVAL_SECONDS` (default `1.0`)
- `SIM_GRID_SIZE` (default `50`)
- `FRONTEND_ORIGINS` (comma-separated CORS allowlist)
- `GEMINI_API_KEY` (required for `POST /api/v1/ai/decide`)

### Frontend
- `NEXT_PUBLIC_API_BASE_URL` (default `http://127.0.0.1:8000`)

## Deployment notes
Live deployment at `http://45.76.69.45` uses an external Nginx reverse proxy on the server. Nginx is responsible for routing requests to the frontend and backend services.

## Security notes
- CORS is allowlisted through `FRONTEND_ORIGINS`
- AI decision logs are written to `backend/logs/ai_decisions.jsonl`
- Do not commit `.env` files or API keys

## Documentation
- Architecture: `docs/ARCHITECTURE.md`
- Backend details: `backend/README.md`
- Frontend details: `frontend/README.md`

## Tech stack
- Python
- FastAPI
- Next.js
- Gemini AI
- Server-Sent Events (SSE)
- Docker Compose

Built by Daniyal Asif.
