import React from 'react';

interface Mission {
  id: string;
  priority: 'High' | 'Medium' | 'Low';
  target: [number, number];
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  assigned_robot: string | null;
}

interface MissionQueueProps {
  missions: Mission[];
}

const MissionQueue: React.FC<MissionQueueProps> = ({ missions }) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-600';
      case 'IN_PROGRESS': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-full">
      <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">Mission Queue</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Robot</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {missions.map((mission) => (
              <tr key={mission.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{mission.id}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(mission.priority)}`}>
                    {mission.priority}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                  [{mission.target[0]}, {mission.target[1]}]
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                  <span className={getStatusColor(mission.status)}>{mission.status}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{mission.assigned_robot || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {missions.length === 0 && (
          <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg mt-2">
            <p>No active missions</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MissionQueue;
