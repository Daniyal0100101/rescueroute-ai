import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Dict, List, Optional
from urllib import error, request as urlrequest

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from ai_decision import make_decision
from models import MapGrid, Metrics, Mission, RobotState, SimulationState

load_dotenv()
os.makedirs("logs", exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("logs/backend.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

SIMULATOR_BASE_URL = os.getenv("SIMULATOR_BASE_URL", "http://127.0.0.1:8001").rstrip("/")
SIM_POLL_INTERVAL_SECONDS = float(os.getenv("SIM_POLL_INTERVAL_SECONDS", "1.0"))
SIM_GRID_SIZE = int(os.getenv("SIM_GRID_SIZE", "50"))


def _parse_allowed_origins() -> List[str]:
    configured = os.getenv("FRONTEND_ORIGINS", "")
    if configured.strip():
        origins = [origin.strip() for origin in configured.split(",") if origin.strip()]
        return origins
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]


def _status_to_ui(status: str) -> str:
    mapping = {
        "idle": "IDLE",
        "moving": "MOVING",
        "charging": "CHARGING",
        "dead": "DEAD",
    }
    return mapping.get(str(status).lower(), str(status).upper())


def _priority_to_ui(priority: str) -> str:
    mapping = {"high": "High", "medium": "Medium", "low": "Low"}
    return mapping.get(str(priority).lower(), str(priority))


def _mission_status_to_ui(status: str) -> str:
    mapping = {
        "pending": "PENDING",
        "active": "IN_PROGRESS",
        "completed": "COMPLETED",
    }
    return mapping.get(str(status).lower(), str(status).upper())


current_state = SimulationState(
    step=0,
    robots=[],
    grid=MapGrid(width=SIM_GRID_SIZE, height=SIM_GRID_SIZE, obstacles=[], charging_stations=[]),
    active_missions=[],
    completed_missions=[],
)

latest_simulator_metrics: Dict[str, float] = {
    "avg_completion_time": 0.0,
    "total_distance_traveled": 0.0,
}

state_lock = asyncio.Lock()
poller_task: Optional[asyncio.Task] = None


def _convert_simulation_state(payload: dict, step: int) -> SimulationState:
    robots = []
    for robot in payload.get("robots", []):
        mission_id = robot.get("mission_id")
        robots.append(
            RobotState(
                id=str(robot.get("id")),
                position=(int(robot.get("x", 0)), int(robot.get("y", 0))),
                battery=float(robot.get("battery", 0.0)),
                status=_status_to_ui(str(robot.get("status", "idle"))),
                current_mission=str(mission_id) if mission_id is not None else None,
            )
        )

    def to_mission(item: dict) -> Mission:
        target = item.get("target") or {}
        assigned_robot = item.get("assigned_robot")
        return Mission(
            id=str(item.get("id")),
            priority=_priority_to_ui(str(item.get("priority", "low"))),
            target=(int(target.get("x", 0)), int(target.get("y", 0))),
            status=_mission_status_to_ui(str(item.get("status", "pending"))),
            assigned_robot=str(assigned_robot) if assigned_robot is not None else None,
        )

    mission_rows = payload.get("missions", [])
    active_missions = [
        to_mission(mission)
        for mission in mission_rows
        if str(mission.get("status", "")).lower() != "completed"
    ]
    completed_missions = [
        to_mission(mission)
        for mission in mission_rows
        if str(mission.get("status", "")).lower() == "completed"
    ]

    obstacles = [
        (int(obstacle.get("x", 0)), int(obstacle.get("y", 0)))
        for obstacle in payload.get("obstacles", [])
    ]
    charging_stations = [
        (int(station.get("x", 0)), int(station.get("y", 0)))
        for station in payload.get("charging_stations", [])
    ]

    return SimulationState(
        step=step,
        robots=robots,
        grid=MapGrid(
            width=SIM_GRID_SIZE,
            height=SIM_GRID_SIZE,
            obstacles=obstacles,
            charging_stations=charging_stations,
        ),
        active_missions=active_missions,
        completed_missions=completed_missions,
    )


async def _fetch_simulator_state() -> Optional[dict]:
    url = f"{SIMULATOR_BASE_URL}/simulation/state"

    def fetch_sync() -> dict:
        with urlrequest.urlopen(url, timeout=4) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)

    try:
        return await asyncio.to_thread(fetch_sync)
    except error.URLError as exc:
        logger.warning("Simulator fetch failed (%s): %s", url, exc)
    except TimeoutError:
        logger.warning("Simulator fetch timed out (%s)", url)
    except Exception as exc:
        logger.error("Unexpected simulator fetch error: %s", exc)
    return None


async def _poll_simulation_forever() -> None:
    logger.info("Simulation poller started against %s", SIMULATOR_BASE_URL)
    step = 0
    while True:
        payload = await _fetch_simulator_state()
        if payload is not None:
            step += 1
            converted = _convert_simulation_state(payload, step)
            metrics = payload.get("metrics") or {}
            async with state_lock:
                global current_state
                current_state = converted
                latest_simulator_metrics["avg_completion_time"] = float(
                    metrics.get("avg_completion_time", 0.0)
                )
                latest_simulator_metrics["total_distance_traveled"] = float(
                    metrics.get("total_distance_traveled", 0.0)
                )
        await asyncio.sleep(SIM_POLL_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    global poller_task
    poller_task = asyncio.create_task(_poll_simulation_forever())
    try:
        yield
    finally:
        if poller_task:
            poller_task.cancel()
            try:
                await poller_task
            except asyncio.CancelledError:
                pass


app = FastAPI(lifespan=lifespan)

allowed_origins = _parse_allowed_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/")
def read_root():
    return {
        "message": "RescueRoute AI Backend Operating Normal",
        "simulator": SIMULATOR_BASE_URL,
    }


@app.get("/api/v1/stream")
async def stream_simulation_state(request: Request):
    async def event_generator():
        while True:
            if await request.is_disconnected():
                logger.info("Client disconnected from stream")
                break

            async with state_lock:
                payload = current_state.model_dump_json()

            yield {"event": "update", "data": payload}
            await asyncio.sleep(1)

    return EventSourceResponse(event_generator())


@app.post("/api/v1/update")
async def update_simulation_state(state: SimulationState):
    try:
        global current_state
        async with state_lock:
            current_state = state
        logger.info("Received manual state update for step %s", state.step)
        return {"status": "received", "step": state.step}
    except Exception as exc:
        logger.error("Error updating state: %s", exc)
        raise HTTPException(status_code=500, detail="Internal Server Error")


@app.post("/api/v1/ai/decide")
def get_ai_decision():
    if not current_state.robots:
        raise HTTPException(
            status_code=400, detail="No simulation state available: no robots in state"
        )

    decision = make_decision(current_state)

    if not decision:
        raise HTTPException(status_code=500, detail="AI Decision failed")

    try:
        log_entry = {"step": current_state.step, "decision": decision.model_dump()}
        with open("logs/ai_decisions.jsonl", "a", encoding="utf-8") as handle:
            handle.write(json.dumps(log_entry) + "\n")
    except (IOError, OSError) as exc:
        logger.error("Failed to write AI decision log: %s", exc)

    return decision


@app.get("/api/v1/state", response_model=SimulationState)
async def get_simulation_state():
    async with state_lock:
        return current_state


@app.get("/api/v1/robots", response_model=List[RobotState])
async def get_robots():
    try:
        async with state_lock:
            return current_state.robots
    except Exception as exc:
        logger.error("Error fetching robots: %s", exc)
        raise HTTPException(status_code=500, detail="Internal Server Error")


@app.get("/api/v1/missions", response_model=List[Mission])
async def get_missions():
    try:
        async with state_lock:
            return current_state.active_missions
    except Exception as exc:
        logger.error("Error fetching missions: %s", exc)
        raise HTTPException(status_code=500, detail="Internal Server Error")


@app.get("/api/v1/metrics", response_model=Metrics)
async def get_metrics():
    try:
        async with state_lock:
            robots = list(current_state.robots)
            completed_count = len(current_state.completed_missions)

        active_count = sum(1 for robot in robots if robot.status != "DEAD")
        current_total_battery = sum(max(0.0, min(100.0, robot.battery)) for robot in robots)
        baseline_total_battery = len(robots) * 100.0
        total_used = max(0.0, baseline_total_battery - current_total_battery)
        fleet_battery = current_total_battery / len(robots) if robots else 0.0

        return Metrics(
            active_robots=active_count,
            completed_missions=completed_count,
            avg_delivery_time=round(latest_simulator_metrics["avg_completion_time"], 1),
            total_battery_used=round(total_used, 1),
            fleet_battery=round(fleet_battery, 1),
            total_distance_traveled=round(
                latest_simulator_metrics["total_distance_traveled"], 1
            ),
        )
    except Exception as exc:
        logger.error("Error fetching metrics: %s", exc)
        raise HTTPException(status_code=500, detail="Internal Server Error")

