"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface Metrics {
  active_robots: number;
  completed_missions: number;
  avg_delivery_time: number;
  total_battery_used: number;
  fleet_battery?: number;
}

interface MetricsPanelProps {
  metrics: Metrics;
}

/** Animated count-up number that pulses on value change. */
function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
}: {
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(value);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (value === prevValue.current && display === value) return;
    const start = display;
    const end = value;
    const duration = 450; // ms
    const startTime = performance.now();
    let rafId = 0;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (end - start) * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };
    rafId = requestAnimationFrame(animate);

    if (value !== prevValue.current) {
      setAnimKey((k) => k + 1);
      prevValue.current = value;
    }
    prevValue.current = value;
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals, suffix]);

  return (
    <motion.span
      key={animKey}
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 0.2 }}
      className="inline-block"
    >
      {decimals > 0 ? display.toFixed(decimals) : Math.round(display)}
      {suffix}
    </motion.span>
  );
}

const MetricsPanel: React.FC<MetricsPanelProps> = ({ metrics }) => {
  const batteryPerRobot = Math.max(
    0,
    Math.min(
      100,
      metrics.fleet_battery ??
        (metrics.active_robots > 0
          ? 100 - metrics.total_battery_used / Math.max(metrics.active_robots, 1)
          : 0),
    ),
  );
  const batteryGlow =
    batteryPerRobot > 50
      ? "0 0 14px rgba(34, 197, 94, 0.18)"
      : batteryPerRobot < 30
        ? "0 0 14px rgba(239, 68, 68, 0.22)"
        : "0 0 14px rgba(245, 158, 11, 0.18)";

  const cards = [
    {
      label: "Active Robots",
      value: metrics.active_robots,
      decimals: 0,
      suffix: "",
      border: "border-blue-500",
      glow: "0 0 14px rgba(59, 130, 246, 0.18)",
    },
    {
      label: "Completed Missions",
      value: metrics.completed_missions,
      decimals: 0,
      suffix: "",
      border: "border-green-500",
      glow: "0 0 14px rgba(34, 197, 94, 0.18)",
    },
    {
      label: "Avg Delivery Time",
      value: metrics.avg_delivery_time,
      decimals: 1,
      suffix: "s",
      border: "border-yellow-500",
      glow: "0 0 14px rgba(245, 158, 11, 0.18)",
    },
    {
      label: "Fleet Battery",
      value: batteryPerRobot,
      decimals: 1,
      suffix: "%",
      border: "border-red-500",
      glow: batteryGlow,
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`min-w-0 rounded-xl border border-slate-800 border-l-4 bg-slate-950/70 p-4 shadow-[0_8px_30px_rgba(2,6,23,0.55)] backdrop-blur-sm transition-colors duration-200 hover:border-slate-700 sm:p-5 ${card.border}`}
          style={{ boxShadow: `${card.glow}, 0 8px 30px rgba(2, 6, 23, 0.55)` }}
        >
          <h3 className="mb-1 text-sm font-medium uppercase text-slate-400">
            {card.label}
          </h3>
          <p className="text-2xl font-semibold text-slate-100 sm:text-3xl">
            <AnimatedNumber
              value={card.value}
              decimals={card.decimals}
              suffix={card.suffix}
            />
          </p>
          {card.label === "Fleet Battery" && (
            <p className="mt-1 text-xs text-slate-400">Average Charge</p>
          )}
        </div>
      ))}
    </div>
  );
};

export default MetricsPanel;
