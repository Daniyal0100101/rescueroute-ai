from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
from typing import List
from models import SimulationState, RobotState, MapGrid, Mission, Metrics

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS Configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for the latest simulation state
# Initialize with a default empty state to avoid errors if queried before first update
current_state = SimulationState(
    step=0,
    robots=[],
    grid=MapGrid(width=10, height=10, obstacles=[], charging_stations=[]),
    active_missions=[],
    completed_missions=[],
)


@app.get("/")
def read_root():
    return {"message": "RescueRoute AI Backend Operating Normal"}


@app.post("/api/v1/update")
def update_simulation_state(state: SimulationState):
    try:
        global current_state
        current_state = state
        logger.info(f"Received state update for step {state.step}")
        return {"status": "received", "step": state.step}
    except Exception as e:
        logger.error(f"Error updating state: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@app.get("/api/v1/state", response_model=SimulationState)
def get_simulation_state():
    return current_state


@app.get("/api/v1/robots", response_model=List[RobotState])
def get_robots():
    try:
        return current_state.robots
    except Exception as e:
        logger.error(f"Error fetching robots: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@app.get("/api/v1/missions", response_model=List[Mission])
def get_missions():
    try:
        return current_state.active_missions
    except Exception as e:
        logger.error(f"Error fetching missions: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@app.get("/api/v1/metrics", response_model=Metrics)
def get_metrics():
    try:
        active_cnt = len(current_state.robots)
        completed_cnt = len(current_state.completed_missions)

        # Calculate avg delivery time (placeholder logic as we lack timestamps)
        avg_time = 0.0

        # Calculate total battery used (approximate: 100 * num_robots - current_total_battery)
        # Assuming robots start at 100 and we want to show 'used' capacity from the start
        current_total_battery = sum(r.battery for r in current_state.robots)
        start_total_battery = active_cnt * 100
        total_used = max(0, start_total_battery - current_total_battery)

        return Metrics(
            active_robots=active_cnt,
            completed_missions=completed_cnt,
            avg_delivery_time=avg_time,
            total_battery_used=total_used,
        )
    except Exception as e:
        logger.error(f"Error fetching metrics: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
