# RescueRoute AI Frontend

Next.js dashboard for live mission control.

## Run
```bash
cd frontend
npm install
npm run dev
```

## Environment
- `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`

## Notes
- Dashboard connects via SSE to `/api/v1/stream`.
- If map appears static, verify backend can reach simulator (`:8001`).
- Event log panel reflects real stream activity and mission status transitions.
