"use client";

import { useEffect, useRef, useState } from "react";
import MapVisualizer from "./MapVisualizer";
import RobotList from "./RobotList";
import MetricsPanel from "./MetricsPanel";
import MissionQueue from "./MissionQueue";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

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
  priority: "High" | "Medium" | "Low";
  target: [number, number];
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  assigned_robot: string | null;
}

interface SimulationState {
  step: number;
  robots: Robot[];
  grid: MapGrid;
  active_missions: Mission[];
  completed_missions?: Mission[];
}

interface Metrics {
  active_robots: number;
  completed_missions: number;
  avg_delivery_time: number;
  total_battery_used: number;
  fleet_battery?: number;
  total_distance_traveled?: number;
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

function nowTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function Dashboard() {
  const [data, setData] = useState<SimulationState | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [aiDecision, setAiDecision] = useState<Decision | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [eventLogs, setEventLogs] = useState<string[]>([]);

  const previousStepRef = useRef<number | null>(null);
  const previousMissionStatusRef = useRef<Record<string, string>>({});

  const appendLog = (entry: string) => {
    setEventLogs((prev) => [`${nowTime()}  ${entry}`, ...prev].slice(0, 20));
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [stateResult, metricsResult] = await Promise.allSettled([
          fetch(`${API_BASE}/api/v1/state`),
          fetch(`${API_BASE}/api/v1/metrics`),
        ]);

        if (stateResult.status === "fulfilled" && stateResult.value.ok) {
          const jsonData = await stateResult.value.json();
          setData(jsonData);
          setConnectionError(null);
        }

        if (metricsResult.status === "fulfilled" && metricsResult.value.ok) {
          const jsonMetrics = await metricsResult.value.json();
          setMetrics(jsonMetrics);
        }

        if (
          stateResult.status === "rejected" ||
          (stateResult.status === "fulfilled" && !stateResult.value.ok)
        ) {
          setConnectionError(`Cannot reach backend at ${API_BASE}`);
          appendLog(`ERROR Backend unreachable at ${API_BASE}`);
        }
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
        setConnectionError(`Cannot reach backend at ${API_BASE}`);
        appendLog("ERROR Initial API request failed");
      }
    };

    fetchInitialData();

    const eventSource = new EventSource(`${API_BASE}/api/v1/stream`);

    eventSource.onopen = () => {
      setConnectionError(null);
      appendLog(`INFO Stream connected to ${API_BASE}`);
    };

    eventSource.onmessage = (event) => {
      try {
        const parsedData: SimulationState = JSON.parse(event.data);
        setData(parsedData);

        if (previousStepRef.current === null) {
          appendLog(`INFO First simulation snapshot received (step ${parsedData.step})`);
        } else if (parsedData.step > previousStepRef.current) {
          appendLog(
            `TICK Step ${parsedData.step} | Robots ${parsedData.robots.length} | Open missions ${parsedData.active_missions.length}`
          );
        }
        previousStepRef.current = parsedData.step;

        const missionStatusMap: Record<string, string> = {};
        const missions = [...parsedData.active_missions, ...(parsedData.completed_missions ?? [])];
        missions.forEach((mission) => {
          missionStatusMap[mission.id] = mission.status;
          const previous = previousMissionStatusRef.current[mission.id];
          if (previous && previous !== mission.status) {
            appendLog(`MISSION ${mission.id} changed ${previous} -> ${mission.status}`);
          }
        });
        previousMissionStatusRef.current = missionStatusMap;

        fetch(`${API_BASE}/api/v1/metrics`)
          .then((res) => (res.ok ? res.json() : null))
          .then((payload) => {
            if (payload) setMetrics(payload);
          })
          .catch((err) => {
            console.error("Error fetching metrics:", err);
          });
      } catch (error) {
        console.error("Error parsing SSE data:", error);
        appendLog("ERROR Invalid stream payload");
      }
    };

    eventSource.onerror = () => {
      setConnectionError(`Stream disconnected from ${API_BASE}`);
      appendLog("WARN Stream disconnected; retrying in 3s");
      eventSource.close();
      setTimeout(() => setReconnectAttempt((n) => n + 1), 3000);
    };

    return () => {
      eventSource.close();
    };
  }, [reconnectAttempt]);

  const handleAiCommand = async () => {
    setIsAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/ai/decide`, { method: "POST" });
      if (res.ok) {
        const decision = await res.json();
        setAiDecision(decision);
        appendLog("AI Decision received");
      } else {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        setAiError(err.detail || "AI request failed");
        appendLog(`ERROR AI command failed: ${err.detail || "Unknown error"}`);
      }
    } catch {
      const message = `Cannot reach backend at ${API_BASE}. Is the server running?`;
      setAiError(message);
      appendLog(`ERROR ${message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  if (!data) {
    return (
      <div className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col gap-5 overflow-x-hidden px-3 py-4 sm:gap-6 sm:px-4 sm:py-6 lg:px-6">
        <header className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/70 p-5 shadow-[0_8px_30px_rgba(2,6,23,0.6)] backdrop-blur-sm md:flex-row md:items-center md:justify-between">
          <div className="w-full max-w-xl animate-pulse">
            <div className="h-7 w-3/4 rounded bg-slate-800/80" />
            <div className="mt-3 h-4 w-5/6 rounded bg-slate-900/70" />
          </div>
          <div className="h-10 w-40 animate-pulse rounded-md bg-slate-800/70" />
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`metric-skel-${index}`}
              className="min-w-0 animate-pulse rounded-xl border border-slate-800 bg-slate-950/70 p-4 shadow-[0_8px_30px_rgba(2,6,23,0.55)] sm:p-5"
            >
              <div className="h-4 w-1/2 rounded bg-slate-800/80" />
              <div className="mt-3 h-8 w-2/5 rounded bg-slate-900/70" />
            </div>
          ))}
        </div>

        <div className="grid min-w-0 gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5 sm:space-y-6">
            <section className="min-w-0 animate-pulse rounded-xl border border-slate-800 bg-slate-950/70 p-3 shadow-lg sm:p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="h-5 w-44 rounded bg-slate-800/80" />
                <div className="h-6 w-20 rounded-full bg-slate-900/70" />
              </div>
              <div className="h-[420px] rounded-lg border border-slate-800 bg-black/60" />
            </section>

            <section className="min-w-0 animate-pulse rounded-xl border border-slate-800 bg-slate-950/70 p-3 shadow-lg sm:p-4">
              <div className="h-5 w-40 rounded bg-slate-800/80" />
              <div className="mt-4 space-y-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={`row-skel-${index}`} className="h-8 rounded bg-slate-900/60" />
                ))}
              </div>
            </section>
          </div>

          <aside className="min-w-0 space-y-5 sm:space-y-6">
            <section className="min-w-0 animate-pulse rounded-xl border border-slate-800 bg-slate-950/70 p-3 shadow-lg sm:p-4">
              <div className="mb-3 h-5 w-32 rounded bg-slate-800/80" />
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={`fleet-skel-${index}`} className="h-16 rounded-lg bg-slate-900/60" />
                ))}
              </div>
            </section>

            <section className="min-w-0 animate-pulse rounded-xl border border-slate-800 bg-slate-950/70 p-3 shadow-lg sm:p-4">
              <div className="mb-3 h-5 w-40 rounded bg-slate-800/80" />
              <div className="h-40 rounded border border-slate-800 bg-slate-950" />
            </section>
          </aside>
        </div>

        {connectionError && <p className="text-center text-sm text-red-400">{connectionError}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col gap-5 overflow-x-hidden px-3 py-4 sm:gap-6 sm:px-4 sm:py-6 lg:px-6">
      <header className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/70 p-5 shadow-[0_8px_30px_rgba(2,6,23,0.6)] backdrop-blur-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100 md:text-3xl">
            RescueRoute Operations Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Live command and control for autonomous emergency response units
          </p>
        </div>
        <button
          onClick={handleAiCommand}
          disabled={isAiLoading}
          aria-busy={isAiLoading}
          aria-label="Run AI decision analysis"
          className={`rounded-md px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
            isAiLoading
              ? "cursor-not-allowed border border-slate-700 bg-slate-800 text-slate-400"
              : "border border-sky-500/40 bg-sky-500/20 text-sky-200 hover:border-sky-400 hover:bg-sky-500/30"
          }`}
        >
          {isAiLoading ? "Analyzing" : "Run AI Decision"}
        </button>
      </header>

      {metrics ? (
        <MetricsPanel metrics={metrics} />
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`metric-skel-live-${index}`}
              className="min-w-0 animate-pulse rounded-xl border border-slate-800 bg-slate-950/70 p-4 shadow-[0_8px_30px_rgba(2,6,23,0.55)] sm:p-5"
            >
              <div className="h-4 w-1/2 rounded bg-slate-800/80" />
              <div className="mt-3 h-8 w-2/5 rounded bg-slate-900/70" />
            </div>
          ))}
        </div>
      )}

      {aiError && <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-300">{aiError}</div>}

      {aiDecision && (
        <div className="rounded-lg border border-sky-500/30 bg-slate-900/80 p-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-sky-300">AI Decision Output</h3>
          <p className="text-sm text-slate-300">{aiDecision.reasoning}</p>
          {aiDecision.priority_mission_id && (
            <p className="mt-2 text-sm text-amber-300">Priority Mission: {aiDecision.priority_mission_id}</p>
          )}
          {aiDecision.reassignments.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-slate-300">
              {aiDecision.reassignments.map((reassignment, index) => (
                <li key={`${reassignment.robot_id}-${reassignment.new_mission_id}-${index}`}>
                  Robot {reassignment.robot_id} reassigned to mission {reassignment.new_mission_id}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid min-w-0 gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5 sm:space-y-6">
          <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/70 p-3 shadow-lg sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">Live Operations Map</h2>
              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
                Step {data.step}
              </span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-black/80 p-2">
              <MapVisualizer grid={data.grid} robots={data.robots} />
            </div>
          </section>

          <MissionQueue missions={data.active_missions || []} />
        </div>

        <aside className="min-w-0 space-y-5 sm:space-y-6">
          <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/70 p-3 shadow-lg sm:p-4">
            <h2 className="mb-3 text-lg font-semibold text-slate-100">Fleet Status</h2>
            <RobotList robots={data.robots} />
          </section>

          <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/70 p-3 shadow-lg sm:p-4">
            <h2 className="mb-3 text-lg font-semibold text-slate-100">System Event Log</h2>
            <div
              className="max-h-[260px] overflow-y-auto rounded border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-300 sm:max-h-[320px] lg:max-h-none lg:overflow-visible"
              role="log"
              aria-live="polite"
            >
              {eventLogs.length === 0 && <p>No events yet. Waiting for stream updates...</p>}
              {eventLogs.map((entry, index) => (
                <p key={`${entry}-${index}`} className="break-words border-b border-slate-900 py-0.5 last:border-b-0">
                  {entry}
                </p>
              ))}
            </div>
            {connectionError && <p className="mt-2 text-xs text-red-400">{connectionError}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
