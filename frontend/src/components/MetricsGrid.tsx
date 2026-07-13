import React, { useState } from 'react';
import type { MetricItem } from '../utils/mockData';

interface MetricsGridProps {
  metrics: {
    bls: MetricItem[];
    transit: MetricItem[];
    physics: MetricItem[];
  };
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ metrics }) => {
  const [activeTab, setActiveTab] = useState<'bls' | 'transit' | 'physics'>('bls');

  const tabs = [
    { id: 'bls', label: 'BLS Search' },
    { id: 'transit', label: 'Transit Parameters' },
    { id: 'physics', label: 'Physics Features' }
  ] as const;

  const currentMetrics = metrics[activeTab];

  return (
    <div className="bg-space-900 border border-space-800 rounded-xl p-6 shadow-xl w-full">
      <div className="flex border-b border-space-800 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              console.log("MetricsGrid tab clicked:", tab.id);
              setActiveTab(tab.id);
            }}
            className={`text-xs uppercase tracking-wider font-extrabold px-4 py-2 rounded-lg transition-all duration-300 cursor-pointer relative z-20 ${
              activeTab === tab.id
                ? 'bg-indigo-500 text-space-950 shadow-lg shadow-indigo-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-space-850/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {currentMetrics.map((item) => (
          <div
            key={item.label}
            className="bg-space-950 border border-space-800 rounded-lg p-4 flex flex-col justify-between hover:border-space-700 transition-all duration-200"
          >
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5 leading-none">
                {item.label}
              </div>
              <div className="text-lg font-mono font-bold text-slate-200 break-words leading-none">
                {item.value}
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-3 border-t border-space-800 pt-2 leading-tight">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
