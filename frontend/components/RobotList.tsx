interface Robot {
  id: string;
  status: string;
  battery: number;
}

interface Props {
  robots: Robot[];
}

const statusConfig: Record<string, { bg: string; text: string; label?: string }> = {
  IDLE:     { bg: "bg-gray-500/20",   text: "text-gray-300" },
  MOVING:   { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  CHARGING: { bg: "bg-amber-500/20",  text: "text-amber-400" },
  DEAD:     { bg: "bg-red-500/20",    text: "text-red-400" },
  BUSY:     { bg: "bg-blue-500/20",   text: "text-blue-400" },
};

function getBatteryColor(battery: number) {
  if (battery > 60) return "bg-emerald-500";
  if (battery > 30) return "bg-amber-500";
  return "bg-red-500";
}

export default function RobotList({ robots }: Props) {
  return (
    <div className="space-y-3">
      {robots.length === 0 && <p className="text-gray-500">No active robots</p>}
      {robots.map((robot) => {
        const cfg = statusConfig[robot.status] || statusConfig.IDLE;
        return (
          <div key={robot.id} className="p-3 border border-gray-700 rounded-lg bg-gray-800/50 backdrop-blur-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-white">{robot.id}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.bg} ${cfg.text}`}>
                {robot.status}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${getBatteryColor(robot.battery)}`}
                style={{ width: `${Math.max(robot.battery, 0)}%` }}
              />
            </div>
            <div className="text-xs text-right mt-1 text-gray-400">
              {robot.battery.toFixed(0)}% Battery
            </div>
          </div>
        );
      })}
    </div>
  );
}
