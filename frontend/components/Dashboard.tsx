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

interface Reassignment {
  robot_id: string;
  new_mission_id: string;
}

interface Decision {
  priority_mission_id: string | null;
  reassignments: Reassignment[];
  reasoning: string;
}

export default function Dashboard() {
  const [data, setData] = useState<SimulationState | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [aiDecision, setAiDecision] = useState<Decision | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch for immediate data
    const fetchInitialData = async () => {
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
        console.error("Failed to fetch initial data:", error);
      }
    };

    fetchInitialData();

    // SSE Setup
    const eventSource = new EventSource("http://localhost:8000/api/v1/stream");

    eventSource.onopen = () => {
        console.log("SSE Connection Opened");
    };

    eventSource.onmessage = (event) => {
        try {
            const parsedData = JSON.parse(event.data);
            setData(parsedData);
            
            // Also fetch metrics when we get a state update
            fetch("http://localhost:8000/api/v1/metrics")
                .then(res => res.json())
                .then(m => setMetrics(m))
                .catch(e => console.error("Error fetching metrics:", e));

        } catch (e) {
            console.error("Error parsing SSE data:", e);
        }
    };

    eventSource.onerror = () => {
        console.warn("SSE connection lost. Reconnecting in 3s...");
        eventSource.close();
        setTimeout(() => {
            // The component will re-mount and create a new EventSource
        }, 3000);
    };

    return () => {
        eventSource.close();
    };
  }, []);

  const handleAiCommand = async () => {
    setIsAiLoading(true);
    setAiError(null);
    try {
        const res = await fetch("http://localhost:8000/api/v1/ai/decide", { method: "POST" });
        if (res.ok) {
            const decision = await res.json();
            setAiDecision(decision);
        } else {
            const err = await res.json().catch(() => ({ detail: "Unknown error" }));
            setAiError(err.detail || "AI request failed");
        }
    } catch (e) {
        setAiError("Cannot reach backend. Is the server running?");
    } finally {
        setIsAiLoading(false);
    }
  };

  if (!data) return <div className="p-8 text-center text-gray-500">Loading RescueRoute AI Simulation...</div>;

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4">
      <header className="mb-2 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">RescueRoute AI Dashboard</h1>
          <p className="text-gray-500">Fleet Management & Mission Control</p>
        </div>
        <button 
            onClick={handleAiCommand}
            disabled={isAiLoading}
            className={`px-6 py-3 rounded-lg font-bold text-white shadow-lg transition-all ${
                isAiLoading ? "bg-purple-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700 hover:scale-105"
            }`}
        >
            {isAiLoading ? "Analyzing..." : "AI Commander: DECIDE"}
        </button>
      </header>

      {metrics && <MetricsPanel metrics={metrics} />}
      
      {aiError && (
         <div className="bg-red-900/30 border border-red-500/50 p-4 rounded-lg">
            <p className="text-red-400 font-semibold">⚠️ AI Error: {aiError}</p>
         </div>
      )}

      {aiDecision && (
         <div className="bg-purple-900/30 border border-purple-500/40 p-4 rounded-lg shadow-lg backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🤖</span>
              <h3 className="text-purple-300 font-bold text-lg">AI Commander Orders</h3>
            </div>
            <p className="text-gray-300 mb-3"><strong className="text-purple-300">Reasoning:</strong> {aiDecision.reasoning}</p>
            {aiDecision.priority_mission_id && (
                <div className="bg-red-900/30 border border-red-500/30 rounded-md px-3 py-2 inline-block">
                  <span className="text-red-400 font-bold text-sm">🎯 Priority Target: {aiDecision.priority_mission_id}</span>
                </div>
            )}
            {aiDecision.reassignments.length > 0 && (
                <div className="mt-3">
                  <p className="text-purple-300 font-semibold text-sm mb-1">Reassignments:</p>
                  <ul className="space-y-1">
                    {aiDecision.reassignments.map((r, i) => (
                        <li key={i} className="text-sm text-gray-400 bg-gray-800/50 rounded px-2 py-1">
                          🔄 Robot <span className="text-white font-semibold">{r.robot_id}</span> → Mission <span className="text-amber-400 font-semibold">{r.new_mission_id}</span>
                        </li>
                    ))}
                  </ul>
                </div>
            )}
         </div>
      )}

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
                {aiDecision && <p className="text-purple-400">[AI] New orders received</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
