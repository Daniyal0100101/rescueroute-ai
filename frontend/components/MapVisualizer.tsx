"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  grid: {
    width: number;
    height: number;
    obstacles: [number, number][];
    charging_stations: [number, number][];
  };
  robots: {
    id: string;
    position: [number, number];
    status: string;
    battery: number;
  }[];
}

export default function MapVisualizer({ grid, robots }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const maxCanvas = 720;
  const baseSize = containerWidth > 0 ? Math.min(maxCanvas, containerWidth - 2) : maxCanvas;
  const cellSize = Math.max(4, Math.floor(baseSize / Math.max(grid.width, grid.height, 1)));
  const mapW = grid.width * cellSize;
  const mapH = grid.height * cellSize;
  const patternId = "grid-pattern";

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    if (typeof ResizeObserver === "undefined") {
      const handleResize = () => setContainerWidth(Math.floor(node.clientWidth));
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setContainerWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(node);
    setContainerWidth(Math.floor(node.clientWidth));

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-full p-1 sm:p-2">
      <div
        className="relative mx-auto overflow-hidden rounded border border-slate-700 bg-black"
        style={{ width: mapW, height: mapH }}
      >
        <svg
          className="pointer-events-none absolute inset-0"
          width={mapW}
          height={mapH}
          style={{ opacity: 0.05 }}
        >
          <defs>
            <pattern id={patternId} width={cellSize} height={cellSize} patternUnits="userSpaceOnUse">
              <path
                d={`M ${cellSize} 0 L 0 0 0 ${cellSize}`}
                fill="none"
                stroke="white"
                strokeWidth={1}
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </svg>

        {grid.charging_stations.map((station, index) => (
          <div
            key={`cs-${index}`}
            className="absolute rounded-full"
            style={{
              left: station[0] * cellSize + cellSize * 0.2,
              top: station[1] * cellSize + cellSize * 0.2,
              width: cellSize * 0.6,
              height: cellSize * 0.6,
              backgroundColor: "rgba(245, 158, 11, 0.9)",
              boxShadow: "0 0 10px rgba(245, 158, 11, 0.45)",
            }}
            title="Charging Station"
          />
        ))}

        {grid.obstacles.map((obstacle, index) => (
          <div
            key={`obs-${index}`}
            className="absolute rounded-sm"
            style={{
              left: obstacle[0] * cellSize + 1,
              top: obstacle[1] * cellSize + 1,
              width: cellSize - 2,
              height: cellSize - 2,
              backgroundColor: "rgba(239, 68, 68, 0.72)",
            }}
            title="Obstacle"
          />
        ))}

        {robots.map((robot) => {
          const isDead = robot.status === "DEAD";
          const isLowBattery = robot.battery < 30;
          const glow = isDead
            ? "rgba(100, 116, 139, 0.45)"
            : isLowBattery
              ? "rgba(239, 68, 68, 0.55)"
              : "rgba(59, 130, 246, 0.55)";

          return (
            <div
              key={robot.id}
              className="absolute flex items-center justify-center rounded-full text-[10px] font-semibold text-white transition-transform duration-200 hover:scale-105"
              style={{
                left: robot.position[0] * cellSize + 1,
                top: robot.position[1] * cellSize + 1,
                width: cellSize - 2,
                height: cellSize - 2,
                backgroundColor: isDead ? "rgba(100, 116, 139, 0.7)" : "rgba(37, 99, 235, 0.92)",
                boxShadow: `0 0 12px ${glow}`,
                willChange: "transform",
              }}
              title={`Robot ${robot.id} | ${robot.status} | Battery ${robot.battery.toFixed(1)}%`}
            >
              {robot.id}
            </div>
          );
        })}

        <div
          className="absolute bottom-3 left-3 flex flex-col gap-1 rounded border border-white/10 px-2 py-1 text-[10px]"
          style={{ backgroundColor: "rgba(2, 6, 23, 0.75)" }}
        >
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
            Robots
          </div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />
            Obstacles
          </div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
            Charging Stations
          </div>
        </div>
      </div>
    </div>
  );
}
