from pydantic import BaseModel
from typing import List, Tuple, Optional


class RobotState(BaseModel):
    id: str
    position: Tuple[int, int]
    battery: float
    status: str  # "IDLE", "MOVING", "CHARGING"
    current_mission: Optional[str] = None


class MapGrid(BaseModel):
    width: int
    height: int
    obstacles: List[Tuple[int, int]]
    charging_stations: List[Tuple[int, int]]


class Mission(BaseModel):
    id: str
    priority: str  # "High", "Medium", "Low"
    target: Tuple[int, int]
    status: str  # "PENDING", "IN_PROGRESS", "COMPLETED"
    assigned_robot: Optional[str] = None


class Metrics(BaseModel):
    active_robots: int
    completed_missions: int
    avg_delivery_time: float
    total_battery_used: float


class SimulationState(BaseModel):
    step: int
    robots: List[RobotState]
    grid: MapGrid
    active_missions: List[Mission]
    completed_missions: List[Mission] = []  # Track completed missions for metrics
