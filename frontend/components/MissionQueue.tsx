import React from "react";

interface Mission {
  id: string;
  priority: "High" | "Medium" | "Low";
  target: [number, number];
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  assigned_robot: string | null;
}

interface MissionQueueProps {
  missions: Mission[];
}

const MissionQueue: React.FC<MissionQueueProps> = ({ missions }) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "bg-red-500/20 text-red-300";
      case "Medium":
        return "bg-amber-500/20 text-amber-300";
      case "Low":
        return "bg-emerald-500/20 text-emerald-300";
      default:
        return "bg-slate-500/20 text-slate-300";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "text-emerald-300";
      case "IN_PROGRESS":
        return "text-sky-300";
      default:
        return "text-slate-300";
    }
  };

  return (
    <div className="h-full min-w-0 rounded-xl border border-slate-800 bg-slate-950/70 p-3 shadow-lg sm:p-4">
      <h2 className="mb-3 border-b border-slate-800 pb-2 text-lg font-semibold text-slate-100">Mission Queue</h2>
      <div className="max-w-full overflow-x-auto">
        <table className="min-w-[560px] w-full table-fixed divide-y divide-slate-800 text-xs sm:text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2 text-left sm:px-3">ID</th>
              <th className="px-2 py-2 text-left sm:px-3">Priority</th>
              <th className="px-2 py-2 text-left sm:px-3">Target</th>
              <th className="px-2 py-2 text-left sm:px-3">Status</th>
              <th className="px-2 py-2 text-left sm:px-3">Robot</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900">
            {missions.map((mission) => (
              <tr key={mission.id} className="transition-colors duration-200 hover:bg-slate-900/70">
                <td className="truncate whitespace-nowrap px-2 py-2 font-medium text-slate-100 sm:px-3">{mission.id}</td>
                <td className="whitespace-nowrap px-2 py-2 sm:px-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getPriorityColor(mission.priority)}`}
                  >
                    {mission.priority}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-2 font-mono text-slate-300 sm:px-3">
                  [{mission.target[0]}, {mission.target[1]}]
                </td>
                <td className="whitespace-nowrap px-2 py-2 font-medium sm:px-3">
                  <span className={getStatusColor(mission.status)}>{mission.status}</span>
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-slate-300 sm:px-3">{mission.assigned_robot || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {missions.length === 0 && (
          <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/60 py-8 text-center text-slate-400">
            <p>No open missions</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MissionQueue;
