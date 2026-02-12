"use client";

import { useEffect, useState } from "react";
import MapVisualizer from "./MapVisualizer";
import RobotList from "./RobotList";
import MetricsPanel from "./MetricsPanel";
import MissionQueue from "./MissionQueue";

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

interface Mission {
  id: string;
  priority: 'High' | 'Medium' | 'Low';
  target: [number, number];
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  assigned_robot: string | null;
}

interface SimulationState {
  step: number;
  robots: Robot[];
  grid: MapGrid;
  active_missions: Mission[];
}

interface Metrics {
  active_robots: number;
  completed_missions: number;
  avg_delivery_time: number;
  total_battery_used: number;
}

export default function Dashboard() {
  const [data, setData] = useState<SimulationState | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [stateRes, metricsRes] = await Promise.all([
            fetch("http://localhost:8000/api/v1/state"),
            fetch("http://localhost:8000/api/v1/metrics")
        ]);

        if (stateRes.ok) {
            const jsonData = await stateRes.json();
            setData(jsonData);
        }
        
        if (metricsRes.ok) {
            const jsonMetrics = await metricsRes.json();
            setMetrics(jsonMetrics);
        }
      } catch (error) {
        console.error("Failed to fetch simulation data:", error);
      }
    };

    // Initial fetch
    fetchData();

    const interval = setInterval(fetchData, 1000); // Poll every second
    return () => clearInterval(interval);
  }, []);

  if (!data) return <div className="p-8 text-center text-gray-500">Loading RescueRoute AI Simulation...</div>;

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4">
      <header className="mb-2">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">RescueRoute AI Dashboard</h1>
        <p className="text-gray-500">Fleet Management & Mission Control</p>
      </header>

      {metrics && <MetricsPanel metrics={metrics} />}

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 flex flex-col gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold dark:text-white">Live Operations Map</h2>
                <span className="text-sm bg-gray-100 px-3 py-1 rounded-full text-gray-600">Step: {data.step}</span>
            </div>
            <div className="flex justify-center bg-gray-50 rounded border border-gray-100 p-4">
                <MapVisualizer grid={data.grid} robots={data.robots} />
            </div>
          </div>
          
          <MissionQueue missions={data.active_missions || []} />
        </div>

        <div className="w-full lg:w-96 flex flex-col gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4 dark:text-white">Fleet Status</h2>
            <RobotList robots={data.robots} />
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-2 dark:text-white">System Logs</h2>
            <div className="h-48 overflow-y-auto w-full bg-gray-900 text-green-400 font-mono text-xs p-3 rounded">
                <p>[SYSTEM] Simulation started</p>
                <p>[INFO] Connected to backend</p>
                <p>[INFO] Monitoring {data.robots.length} active units</p>
                {data.active_missions?.map(m => (
                    <p key={m.id}>[MISSION] {m.id} assigned to {m.assigned_robot || 'pending'}</p>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
