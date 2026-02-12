"use client";

import { useEffect, useState } from "react";
import MapVisualizer from "./MapVisualizer";
import RobotList from "./RobotList";

// Define types locally for now, should mirror backend
interface Robot {
  id: string;
  status: string;
  battery: number;
  position: [number, number];
}

interface MapGrid {
  width: number;
  height: number;
  obstacles: [number, number][];
  charging_stations: [number, number][];
}

interface SimulationState {
  step: number;
  robots: Robot[];
  grid: MapGrid;
}

export default function Dashboard() {
  const [data, setData] = useState<SimulationState | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/v1/state");
        if (res.ok) {
            const jsonData = await res.json();
            setData(jsonData);
        }
      } catch (error) {
        console.error("Failed to fetch simulation state:", error);
      }
    };

    const interval = setInterval(fetchData, 1000); // Poll every second
    return () => clearInterval(interval);
  }, []);

  if (!data) return <div>Loading Simulation Data...</div>;

  return (
    <div className="flex flex-col md:flex-row gap-4 w-full max-w-6xl">
      <div className="flex-1 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Live Map (Step: {data.step})</h2>
        <MapVisualizer grid={data.grid} robots={data.robots} />
      </div>
      <div className="w-full md:w-80 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Fleet Status</h2>
        <RobotList robots={data.robots} />
      </div>
    </div>
  );
}
