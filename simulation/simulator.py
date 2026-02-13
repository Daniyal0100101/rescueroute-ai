"""
RescueRoute AI - Production disaster response simulator.
"""

import asyncio
import heapq
import logging
import os
import random
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("rescueroute.simulator")

GRID_SIZE = 50
TICK_INTERVAL_SECONDS = 1.0
BATTERY_DRAIN_PER_MOVE = 2.0
BATTERY_CHARGE_PER_TICK = 10.0
LOW_BATTERY_THRESHOLD = 20.0
MIN_BATTERY_FOR_MISSION = 50.0
PRIORITY_SCORES = {"high": 3, "medium": 2, "low": 1}


class Position(BaseModel):
    x: int
    y: int


class RobotOut(BaseModel):
    id: int
    x: int
    y: int
    battery: float
    status: str
    mission_id: Optional[int] = None


class MissionOut(BaseModel):
    id: int
    priority: str
    target: Position
    status: str
    assigned_robot: Optional[int] = None


class ObstacleOut(BaseModel):
    type: str
    x: int
    y: int


class ChargingStationOut(BaseModel):
    x: int
    y: int


class MetricsOut(BaseModel):
    active_robots: int
    completed_missions: int
    pending_missions: int
    total_distance_traveled: float
    avg_completion_time: float


class SimulationStateOut(BaseModel):
    robots: list[RobotOut]
    missions: list[MissionOut]
    obstacles: list[ObstacleOut]
    charging_stations: list[ChargingStationOut]
    metrics: MetricsOut
    timestamp: str


class Robot:
    def __init__(self, robot_id: int, x: int, y: int) -> None:
        self.id = robot_id
        self.x = x
        self.y = y
        self.battery = 100.0
        self.status = "idle"  # idle | moving | charging | dead
        self.mission_id: Optional[int] = None
        self.path: list[tuple[int, int]] = []
        self.total_distance_traveled = 0.0
        self.charge_destination: Optional[tuple[int, int]] = None

    def to_out(self) -> RobotOut:
        return RobotOut(
            id=self.id,
            x=self.x,
            y=self.y,
            battery=round(self.battery, 1),
            status=self.status,
            mission_id=self.mission_id,
        )


class Mission:
    def __init__(self, mission_id: int, priority: str, target_x: int, target_y: int) -> None:
        self.id = mission_id
        self.priority = priority
        self.target_x = target_x
        self.target_y = target_y
        self.status = "pending"  # pending | active | completed
        self.assigned_robot: Optional[int] = None
        self.start_time: Optional[float] = None
        self.completion_time: Optional[float] = None

    def to_out(self) -> MissionOut:
        return MissionOut(
            id=self.id,
            priority=self.priority,
            target=Position(x=self.target_x, y=self.target_y),
            status=self.status,
            assigned_robot=self.assigned_robot,
        )


class Obstacle:
    def __init__(self, x: int, y: int, obstacle_type: str = "debris") -> None:
        self.type = obstacle_type
        self.x = x
        self.y = y


class ChargingStation:
    def __init__(self, x: int, y: int) -> None:
        self.x = x
        self.y = y


def astar(
    start: tuple[int, int],
    goal: tuple[int, int],
    blocked: set[tuple[int, int]],
    grid_size: int = GRID_SIZE,
) -> list[tuple[int, int]]:
    """A* using Manhattan heuristic. Returns full path [start..goal] or empty list if unreachable."""
    if start == goal:
        return [start]
    if goal in blocked:
        return []

    def heuristic(a: tuple[int, int], b: tuple[int, int]) -> int:
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    open_heap: list[tuple[int, int, tuple[int, int]]] = []
    heapq.heappush(open_heap, (heuristic(start, goal), 0, start))

    g_score: dict[tuple[int, int], int] = {start: 0}
    came_from: dict[tuple[int, int], tuple[int, int]] = {}
    visited: set[tuple[int, int]] = set()
    directions = ((1, 0), (-1, 0), (0, 1), (0, -1))

    while open_heap:
        _, current_g, current = heapq.heappop(open_heap)
        if current in visited:
            continue
        visited.add(current)

        if current == goal:
            path = [current]
            while current in came_from:
                current = came_from[current]
                path.append(current)
            path.reverse()
            return path

        for dx, dy in directions:
            nx, ny = current[0] + dx, current[1] + dy
            neighbor = (nx, ny)
            if not (0 <= nx < grid_size and 0 <= ny < grid_size):
                continue
            if neighbor in blocked:
                continue

            tentative_g = current_g + 1
            if tentative_g < g_score.get(neighbor, 10**9):
                g_score[neighbor] = tentative_g
                came_from[neighbor] = current
                f_score = tentative_g + heuristic(neighbor, goal)
                heapq.heappush(open_heap, (f_score, tentative_g, neighbor))

    return []


class SimulationEngine:
    def __init__(self) -> None:
        self.tick_count = 0
        self.completed_times: list[float] = []
        self.robots: list[Robot] = []
        self.missions: list[Mission] = []
        self.obstacles: list[Obstacle] = []
        self.charging_stations: list[ChargingStation] = []
        self.blocked: set[tuple[int, int]] = set()
        self.reset()

    def reset(self) -> None:
        self.tick_count = 0
        self.completed_times.clear()

        self.charging_stations = [
            ChargingStation(5, 5),
            ChargingStation(45, 5),
            ChargingStation(25, 45),
        ]
        station_positions = {(s.x, s.y) for s in self.charging_stations}

        obstacle_positions: set[tuple[int, int]] = set()
        while len(obstacle_positions) < 10:
            candidate = (
                random.randint(0, GRID_SIZE - 1),
                random.randint(0, GRID_SIZE - 1),
            )
            if candidate in station_positions:
                continue
            obstacle_positions.add(candidate)
        self.obstacles = [Obstacle(x, y) for x, y in obstacle_positions]
        self.blocked = {(o.x, o.y) for o in self.obstacles}

        self.robots = []
        for robot_id in range(1, 6):
            x, y = self._random_free_cell(station_positions=station_positions)
            self.robots.append(Robot(robot_id, x, y))

        self.missions = []
        mission_id = 1
        for priority in ("high", "medium", "low"):
            for _ in range(5):
                tx, ty = self._random_free_cell(station_positions=station_positions)
                self.missions.append(Mission(mission_id, priority, tx, ty))
                mission_id += 1

        logger.info(
            "Simulation reset: robots=%s missions=%s obstacles=%s",
            len(self.robots),
            len(self.missions),
            len(self.obstacles),
        )

    def _random_free_cell(self, station_positions: set[tuple[int, int]]) -> tuple[int, int]:
        while True:
            x = random.randint(0, GRID_SIZE - 1)
            y = random.randint(0, GRID_SIZE - 1)
            pos = (x, y)
            if pos not in self.blocked and pos not in station_positions:
                return pos

    def tick(self) -> None:
        self.tick_count += 1
        self._assign_pending_missions()
        self._move_robots_one_step()
        self._process_mission_completion()
        self._manage_battery_and_charging()
        self._mark_dead_robots()

    def _assign_pending_missions(self) -> None:
        pending = [m for m in self.missions if m.status == "pending"]
        if not pending:
            return
        pending.sort(key=lambda m: PRIORITY_SCORES.get(m.priority, 0), reverse=True)

        for mission in pending:
            idle_robots = [
                r
                for r in self.robots
                if r.status == "idle" and r.battery > MIN_BATTERY_FOR_MISSION
            ]
            if not idle_robots:
                return

            nearest_robot = min(
                idle_robots,
                key=lambda r: abs(r.x - mission.target_x) + abs(r.y - mission.target_y),
            )
            path = astar(
                start=(nearest_robot.x, nearest_robot.y),
                goal=(mission.target_x, mission.target_y),
                blocked=self.blocked,
            )
            if not path:
                logger.warning(
                    "Mission %s currently unreachable at (%s,%s)",
                    mission.id,
                    mission.target_x,
                    mission.target_y,
                )
                continue

            nearest_robot.path = path[1:]
            nearest_robot.status = "moving"
            nearest_robot.mission_id = mission.id
            nearest_robot.charge_destination = None

            mission.status = "active"
            mission.assigned_robot = nearest_robot.id
            mission.start_time = mission.start_time or time.time()

            logger.info(
                "Mission %s (%s) assigned to robot %s",
                mission.id,
                mission.priority,
                nearest_robot.id,
            )

    def _move_robots_one_step(self) -> None:
        for robot in self.robots:
            if robot.status != "moving":
                continue

            if not robot.path:
                # Arrived at destination used by mission or charging route.
                if robot.charge_destination and (robot.x, robot.y) == robot.charge_destination:
                    robot.status = "charging"
                else:
                    robot.status = "idle"
                continue

            next_x, next_y = robot.path.pop(0)
            robot.x, robot.y = next_x, next_y
            robot.battery = max(0.0, robot.battery - BATTERY_DRAIN_PER_MOVE)
            robot.total_distance_traveled += 1.0

    def _process_mission_completion(self) -> None:
        for robot in self.robots:
            if robot.status == "dead" or robot.mission_id is None:
                continue

            mission = next((m for m in self.missions if m.id == robot.mission_id), None)
            if mission is None or mission.status != "active":
                continue

            at_target = robot.x == mission.target_x and robot.y == mission.target_y
            if at_target and not robot.path:
                mission.status = "completed"
                mission.completion_time = time.time()
                if mission.start_time is not None:
                    self.completed_times.append(mission.completion_time - mission.start_time)
                robot.mission_id = None
                robot.path.clear()
                robot.status = "idle"
                logger.info("Mission %s completed by robot %s", mission.id, robot.id)

    def _manage_battery_and_charging(self) -> None:
        stations = [(s.x, s.y) for s in self.charging_stations]

        for robot in self.robots:
            if robot.status == "dead":
                continue

            at_station = (robot.x, robot.y) in stations
            if at_station and robot.battery < 100:
                robot.status = "charging"
                robot.battery = min(100.0, robot.battery + BATTERY_CHARGE_PER_TICK)
                robot.path.clear()
                robot.charge_destination = (robot.x, robot.y)
                if robot.battery >= 100:
                    robot.status = "idle"
                    robot.charge_destination = None
                continue

            if robot.battery < LOW_BATTERY_THRESHOLD and not at_station:
                self._release_mission(robot)
                nearest_station = min(
                    stations, key=lambda p: abs(p[0] - robot.x) + abs(p[1] - robot.y)
                )
                path = astar((robot.x, robot.y), nearest_station, self.blocked)
                if path:
                    robot.path = path[1:]
                    robot.charge_destination = nearest_station
                    robot.status = "moving"
                else:
                    # If no route to charger exists, robot cannot continue operating.
                    robot.status = "dead"
                    robot.path.clear()
                    logger.error(
                        "Robot %s cannot reach charging station and is marked dead",
                        robot.id,
                    )

    def _mark_dead_robots(self) -> None:
        for robot in self.robots:
            if robot.status == "dead":
                continue
            if robot.battery <= 0.0:
                self._release_mission(robot)
                robot.status = "dead"
                robot.path.clear()
                robot.charge_destination = None
                logger.warning("Robot %s battery depleted, marked dead", robot.id)

    def _release_mission(self, robot: Robot) -> None:
        if robot.mission_id is None:
            return
        mission = next((m for m in self.missions if m.id == robot.mission_id), None)
        if mission and mission.status == "active":
            mission.status = "pending"
            mission.assigned_robot = None
            mission.start_time = None
        robot.mission_id = None

    def get_state(self) -> SimulationStateOut:
        completed = sum(1 for m in self.missions if m.status == "completed")
        pending = sum(1 for m in self.missions if m.status == "pending")
        active_robots = sum(1 for r in self.robots if r.status != "dead")
        total_distance = sum(r.total_distance_traveled for r in self.robots)
        avg_completion = (
            sum(self.completed_times) / len(self.completed_times) if self.completed_times else 0.0
        )
        timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        return SimulationStateOut(
            robots=[robot.to_out() for robot in self.robots],
            missions=[mission.to_out() for mission in self.missions],
            obstacles=[ObstacleOut(type=o.type, x=o.x, y=o.y) for o in self.obstacles],
            charging_stations=[
                ChargingStationOut(x=station.x, y=station.y)
                for station in self.charging_stations
            ],
            metrics=MetricsOut(
                active_robots=active_robots,
                completed_missions=completed,
                pending_missions=pending,
                total_distance_traveled=round(total_distance, 1),
                avg_completion_time=round(avg_completion, 1),
            ),
            timestamp=timestamp,
        )


engine = SimulationEngine()
state_lock = asyncio.Lock()
sim_task: Optional[asyncio.Task] = None


async def simulation_loop() -> None:
    logger.info("Simulation background loop started")
    while True:
        try:
            async with state_lock:
                engine.tick()
        except Exception:
            logger.exception("Unhandled simulator error during tick")
        await asyncio.sleep(TICK_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    global sim_task
    sim_task = asyncio.create_task(simulation_loop())
    try:
        yield
    finally:
        if sim_task:
            sim_task.cancel()
            try:
                await sim_task
            except asyncio.CancelledError:
                pass
        logger.info("Simulation background loop stopped")


_sim_allowed_origins = os.getenv("SIMULATOR_ALLOWED_ORIGINS", "").strip()
if _sim_allowed_origins:
    SIMULATOR_ALLOWED_ORIGINS = [
        origin.strip() for origin in _sim_allowed_origins.split(",") if origin.strip()
    ]
else:
    SIMULATOR_ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

app = FastAPI(title="RescueRoute AI Simulator", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=SIMULATOR_ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/simulation/state", response_model=SimulationStateOut)
async def get_simulation_state() -> SimulationStateOut:
    async with state_lock:
        return engine.get_state()


@app.post("/simulation/reset")
async def reset_simulation() -> dict[str, str]:
    async with state_lock:
        engine.reset()
    return {"status": "reset"}

