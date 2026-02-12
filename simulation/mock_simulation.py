import requests
import time
import random


API_URL = "http://localhost:8000/api/v1/update"

# Configuration
GRID_WIDTH = 10
GRID_HEIGHT = 10
CHARGING_STATIONS = [[0, 0], [9, 9]]
OBSTACLES = [[2, 2], [3, 3], [4, 4], [5, 5], [5, 6]]


class Robot:
    def __init__(self, id, start_pos):
        self.id = id
        self.start_pos = list(start_pos)
        self.position = list(start_pos)
        self.battery = 100.0
        self.status = "IDLE"  # IDLE, MOVING, CHARGING, DEAD
        self.current_mission = None
        self.target = None
        self.dead_timer = 0

    def move_towards(self, target):
        if self.battery <= 0:
            self.status = "DEAD"
            return

        dx = target[0] - self.position[0]
        dy = target[1] - self.position[1]

        move_x = 0
        move_y = 0

        if dx != 0:
            move_x = 1 if dx > 0 else -1
        elif dy != 0:
            move_y = 1 if dy > 0 else -1

        new_x = self.position[0] + move_x
        new_y = self.position[1] + move_y

        # Check boundaries and obstacles
        if (
            0 <= new_x < GRID_WIDTH
            and 0 <= new_y < GRID_HEIGHT
            and [new_x, new_y] not in OBSTACLES
        ):
            self.position = [new_x, new_y]
            self.battery -= 2.0
            self.status = "MOVING"
        else:
            # Blocked logic (scenario 1)
            print(f"Robot {self.id} path blocked at {new_x}, {new_y}. Rerouting...")
            # Simple reroute: try perpendicular move
            if move_x != 0:
                self.position[1] = min(max(0, self.position[1] + 1), GRID_HEIGHT - 1)
            else:
                self.position[0] = min(max(0, self.position[0] + 1), GRID_WIDTH - 1)
            self.battery -= 2.0

    def update(self):
        # Dead robot recovery: after 3 steps, revive with minimal battery
        if self.status == "DEAD":
            self.dead_timer += 1
            if self.dead_timer >= 3:
                self.battery = 5.0
                self.dead_timer = 0
                self.position = list(self.start_pos)
                self.target = CHARGING_STATIONS[0]
                self.status = "MOVING"
                self.current_mission = None
                print(f"Robot {self.id} recovered! Heading to charging station.")
            return

        # Low battery: return to charge at 30% threshold
        if self.battery < 30 and self.status not in ("CHARGING", "DEAD"):
            # Find closest charging station
            closest_cs = min(
                CHARGING_STATIONS,
                key=lambda cs: abs(cs[0] - self.position[0])
                + abs(cs[1] - self.position[1]),
            )
            self.target = closest_cs
            self.status = "MOVING"
            if self.current_mission:
                self.current_mission["status"] = "PENDING"
                self.current_mission["assigned_robot"] = None
                self.current_mission = None
            print(
                f"Robot {self.id} Low Battery ({self.battery:.0f}%)! Returning to charge."
            )

        if self.status == "CHARGING":
            self.battery = min(100, self.battery + 10)
            if self.battery >= 100:
                self.status = "IDLE"
                self.target = None
            return

        if self.target:
            if self.position == self.target:
                if self.battery < 100 and self.position in CHARGING_STATIONS:
                    self.status = "CHARGING"
                elif self.current_mission:
                    print(
                        f"Robot {self.id} completed mission {self.current_mission['id']}"
                    )
                    self.status = "IDLE"
                    self.current_mission["status"] = "COMPLETED"
                    completed_missions.append(self.current_mission)
                    if self.current_mission in active_missions:
                        active_missions.remove(self.current_mission)
                    self.current_mission = None
                    self.target = None
            else:
                self.move_towards(self.target)


robots = [Robot("R1", [0, 0]), Robot("R2", [9, 0]), Robot("R3", [0, 9])]

active_missions = []
completed_missions = []
mission_counter = 1


def generate_mission():
    global mission_counter
    if len(active_missions) < 5 and random.random() < 0.3:
        target = [random.randint(0, GRID_WIDTH - 1), random.randint(0, GRID_HEIGHT - 1)]
        while target in OBSTACLES or target in CHARGING_STATIONS:
            target = [
                random.randint(0, GRID_WIDTH - 1),
                random.randint(0, GRID_HEIGHT - 1),
            ]

        mission = {
            "id": f"M{mission_counter:03d}",
            "priority": random.choice(["High", "Medium", "Low"]),
            "target": target,
            "status": "PENDING",
            "assigned_robot": None,
        }
        active_missions.append(mission)
        print(f"New Mission Generated: {mission['id']} at {mission['target']}")
        mission_counter += 1


def assign_missions():
    for mission in active_missions:
        if mission["status"] == "PENDING":
            # Find available robot (not dead, not charging, idle)
            available_robots = [
                r for r in robots if r.status == "IDLE" and r.battery > 20
            ]
            if available_robots:
                # Assign to closest robot
                best_robot = min(
                    available_robots,
                    key=lambda r: abs(r.position[0] - mission["target"][0])
                    + abs(r.position[1] - mission["target"][1]),
                )
                best_robot.current_mission = mission
                best_robot.target = mission["target"]
                best_robot.status = "MOVING"
                mission["status"] = "IN_PROGRESS"
                mission["assigned_robot"] = best_robot.id
                print(f"Assigned Mission {mission['id']} to {best_robot.id}")


def run_mock_simulation():
    step = 0
    print(f"Starting detailed mock simulation, pushing to {API_URL}...")
    try:
        while True:
            generate_mission()
            assign_missions()

            robot_states = []
            for r in robots:
                r.update()
                robot_states.append(
                    {
                        "id": r.id,
                        "position": r.position,
                        "battery": r.battery,
                        "status": r.status,
                        "current_mission": r.current_mission["id"]
                        if r.current_mission
                        else None,
                    }
                )

            state = {
                "step": step,
                "robots": robot_states,
                "grid": {
                    "width": GRID_WIDTH,
                    "height": GRID_HEIGHT,
                    "obstacles": OBSTACLES,
                    "charging_stations": CHARGING_STATIONS,
                },
                "active_missions": active_missions,
                "completed_missions": completed_missions,
            }

            try:
                response = requests.post(API_URL, json=state)
                if response.status_code != 200:
                    print(
                        f"Step {step}: Failed {response.status_code} - {response.text}"
                    )
            except Exception as e:
                print(f"Connection error: {e}")

            step += 1
            time.sleep(1)
    except KeyboardInterrupt:
        print("Stopping mock simulation.")


if __name__ == "__main__":
    run_mock_simulation()
