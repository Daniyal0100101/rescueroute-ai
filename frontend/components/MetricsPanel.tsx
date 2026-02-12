import React from 'react';

// Define Metrics interface
interface Metrics {
  active_robots: number;
  completed_missions: number;
  avg_delivery_time: number;
  total_battery_used: number;
}

interface MetricsPanelProps {
  metrics: Metrics;
}

const MetricsPanel: React.FC<MetricsPanelProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
        <h3 className="text-gray-500 text-sm font-medium uppercase mb-1">Active Robots</h3>
        <p className="text-3xl font-bold text-gray-800">{metrics.active_robots}</p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
        <h3 className="text-gray-500 text-sm font-medium uppercase mb-1">Completed Missions</h3>
        <p className="text-3xl font-bold text-gray-800">{metrics.completed_missions}</p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
        <h3 className="text-gray-500 text-sm font-medium uppercase mb-1">Avg Delivery Time</h3>
        <p className="text-3xl font-bold text-gray-800">{metrics.avg_delivery_time.toFixed(1)}s</p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-500">
        <h3 className="text-gray-500 text-sm font-medium uppercase mb-1">Fleet Battery Usage</h3>
        <p className="text-3xl font-bold text-gray-800">{metrics.total_battery_used.toFixed(1)}</p>
        <p className="text-xs text-gray-400 mt-1">Total Consumption</p>
      </div>
    </div>
  );
};

export default MetricsPanel;
