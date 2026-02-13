interface Robot {
  id: string;
  status: string;
  battery: number;
}

interface Props {
  robots: Robot[];
}

const statusConfig: Record<string, { bg: string; text: string }> = {
  IDLE: { bg: "bg-slate-500/20", text: "text-slate-300" },
  MOVING: { bg: "bg-emerald-500/20", text: "text-emerald-300" },
  CHARGING: { bg: "bg-amber-500/20", text: "text-amber-300" },
  DEAD: { bg: "bg-red-500/20", text: "text-red-300" },
};

function getBatteryColor(battery: number) {
  if (battery > 60) return "bg-emerald-500";
  if (battery > 30) return "bg-amber-500";
  return "bg-red-500";
}

export default function RobotList({ robots }: Props) {
  return (
    <div className="space-y-3">
      {robots.length === 0 && <p className="text-sm text-slate-400">No active robots</p>}
      {robots.map((robot) => {
        const normalizedStatus = (robot.status || "IDLE").toUpperCase();
        const cfg = statusConfig[normalizedStatus] || statusConfig.IDLE;
        const clampedBattery = Math.min(100, Math.max(0, robot.battery));

        return (
          <div
            key={robot.id}
            className="rounded-lg border border-slate-800 bg-slate-900/65 p-3 transition-colors duration-200 hover:border-slate-700"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold text-slate-100">Robot {robot.id}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
                {normalizedStatus}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${getBatteryColor(clampedBattery)}`}
                style={{ width: `${clampedBattery}%` }}
              />
            </div>
            <div className="mt-1 text-right text-xs text-slate-400">{clampedBattery.toFixed(0)}% battery</div>
          </div>
        );
      })}
    </div>
  );
}
