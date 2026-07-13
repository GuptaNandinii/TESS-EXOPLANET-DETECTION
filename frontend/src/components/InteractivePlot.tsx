import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  ReferenceLine,
  ReferenceDot
} from 'recharts';
import { Download, LineChart as ChartIcon, Maximize2, X } from 'lucide-react';

interface InteractivePlotProps {
  originalCurve: { time: number; flux: number }[];
  detrendedCurve: { time: number; flux: number }[];
  periodogram: { period: number; power: number }[];
  foldedCurve: { phase: number; flux: number; model: number }[];
  bestPeriod?: number;
  bestPower?: number;
}

export const InteractivePlot: React.FC<InteractivePlotProps> = ({
  originalCurve,
  detrendedCurve,
  periodogram,
  foldedCurve,
  bestPeriod,
  bestPower
}) => {
  const [fullscreenPlot, setFullscreenPlot] = useState<string | null>(null);

  const handleDownload = (plotType: string) => {
    alert(`PNG download is simulated for the ${plotType} plot.`);
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center space-x-2 border-b border-space-800 pb-3">
        <ChartIcon className="w-5 h-5 text-indigo-400" />
        <h2 className="text-xl font-bold tracking-wider text-slate-100 uppercase">Scientific Light Curve Analysis</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 1. Raw Light Curve */}
        <div className="bg-space-900/60 backdrop-blur-md border border-space-800/80 rounded-xl p-6 shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-400">1. Raw Aperture Photometry</span>
            <div className="flex items-center space-x-1">
              <button onClick={() => setFullscreenPlot("Raw")} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-space-800/50 rounded-lg transition-colors" title="Fullscreen View">
                <Maximize2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDownload("Raw")} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-space-800/50 rounded-lg transition-colors" title="Download PNG">
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="bg-space-950/80 border border-space-850 rounded-xl p-3">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={originalCurve} margin={{ top: 15, right: 10, left: 15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937/40" horizontal={true} vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 9, fill: '#64748b' }} label={{ value: 'Time (BJD - 2457000)', position: 'insideBottom', offset: -12, fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 9, fill: '#64748b' }} domain={['auto', 'auto']} label={{ value: 'Flux (e-/s)', angle: -90, position: 'insideLeft', offset: -10, fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0b0f19', borderColor: '#1f2937', borderRadius: '8px' }} labelStyle={{ color: '#94a3b8' }} />
                <Legend verticalAlign="top" height={32} iconSize={10} wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} />
                <Line name="Raw Data" type="monotone" dataKey="flux" stroke="#818cf8" dot={false} strokeWidth={1} />
                <Line name="Baseline Trend" type="monotone" dataKey="baseline" stroke="#ef4444" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Detrended Light Curve */}
        <div className="bg-space-900/60 backdrop-blur-md border border-space-800/80 rounded-xl p-6 shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-extrabold uppercase tracking-wider text-teal-400">2. Detrended Light Curve</span>
            <div className="flex items-center space-x-1">
              <button onClick={() => setFullscreenPlot("Detrended")} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-space-800/50 rounded-lg transition-colors" title="Fullscreen View">
                <Maximize2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDownload("Detrended")} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-space-800/50 rounded-lg transition-colors" title="Download PNG">
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="bg-space-950/80 border border-space-850 rounded-xl p-3">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={detrendedCurve} margin={{ top: 15, right: 10, left: 15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937/40" horizontal={true} vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 9, fill: '#64748b' }} label={{ value: 'Time (BJD - 2457000)', position: 'insideBottom', offset: -12, fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 9, fill: '#64748b' }} domain={['auto', 'auto']} label={{ value: 'Detrended Flux (Relative)', angle: -90, position: 'insideLeft', offset: -10, fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0b0f19', borderColor: '#1f2937', borderRadius: '8px' }} labelStyle={{ color: '#94a3b8' }} />
                <Legend verticalAlign="top" height={32} iconSize={10} wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} />
                <Line name="Detrended Data" type="monotone" dataKey="flux" stroke="#2dd4bf" dot={false} strokeWidth={1} />
                <Line name="Trapezoid Model" type="monotone" dataKey="model" stroke="#ef4444" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. BLS Periodogram */}
        <div className="bg-space-900/60 backdrop-blur-md border border-space-800/80 rounded-xl p-6 shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 block">3. BLS Power Spectrum</span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                Period Range: 0.5–15.0 days (12–360 hrs) | Grid: 6000 | Durations: 50
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <button onClick={() => setFullscreenPlot("Periodogram")} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-space-800/50 rounded-lg transition-colors" title="Fullscreen View">
                <Maximize2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDownload("Periodogram")} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-space-800/50 rounded-lg transition-colors" title="Download PNG">
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="bg-space-950/80 border border-space-850 rounded-xl p-3">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={periodogram} margin={{ top: 20, right: 10, left: 15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937/40" horizontal={true} vertical={false} />
                <XAxis 
                  dataKey="period" 
                  type="number"
                  domain={[0.5, 15.0]}
                  ticks={[0.5, 2.0, 4.0, 6.0, 8.0, 10.0, 12.0, 15.0]}
                  stroke="#64748b" 
                  tick={{ fontSize: 9, fill: '#64748b' }} 
                  label={{ value: 'Trial Period (days)', position: 'insideBottom', offset: -12, fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} 
                />
                <YAxis stroke="#64748b" tick={{ fontSize: 9, fill: '#64748b' }} label={{ value: 'BLS Power Spectrum', angle: -90, position: 'insideLeft', offset: -10, fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0b0f19', borderColor: '#1f2937', borderRadius: '8px' }} labelStyle={{ color: '#94a3b8' }} />
                {bestPeriod && (
                  <ReferenceLine 
                    x={bestPeriod} 
                    stroke="#ef4444" 
                    strokeDasharray="4 4" 
                    strokeWidth={1.5}
                    label={{ value: `Peak: ${bestPeriod.toFixed(4)} d`, fill: '#ef4444', fontSize: 10, position: 'top', fontWeight: 'bold' }} 
                  />
                )}
                {bestPeriod && bestPower && (
                  <ReferenceDot 
                    x={bestPeriod} 
                    y={bestPower} 
                    r={5} 
                    fill="#ef4444" 
                    stroke="#ffffff" 
                    strokeWidth={1.5}
                  />
                )}
                <Area type="monotone" dataKey="power" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Phase Folded Light Curve & Model */}
        <div className="bg-space-900/60 backdrop-blur-md border border-space-800/80 rounded-xl p-6 shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-extrabold uppercase tracking-wider text-rose-450">4. Phase-Folded fit overlay</span>
            <div className="flex items-center space-x-1">
              <button onClick={() => setFullscreenPlot("Folded")} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-space-800/50 rounded-lg transition-colors" title="Fullscreen View">
                <Maximize2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDownload("Folded")} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-space-800/50 rounded-lg transition-colors" title="Download PNG">
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="bg-space-950/80 border border-space-850 rounded-xl p-3">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={foldedCurve} margin={{ top: 15, right: 10, left: 15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937/40" horizontal={true} vertical={false} />
                <XAxis dataKey="phase" stroke="#64748b" tick={{ fontSize: 9, fill: '#64748b' }} label={{ value: 'Orbital Phase', position: 'insideBottom', offset: -12, fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 9, fill: '#64748b' }} domain={['auto', 'auto']} label={{ value: 'Normalized Flux', angle: -90, position: 'insideLeft', offset: -10, fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0b0f19', borderColor: '#1f2937', borderRadius: '8px' }} labelStyle={{ color: '#94a3b8' }} />
                <Legend verticalAlign="top" height={32} iconSize={10} wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} />
                <Line name="Data" type="monotone" dataKey="flux" stroke="#64748b" dot={{ r: 1.5, fill: '#475569' }} strokeWidth={0} />
                <Line name="Trapezoid Model" type="monotone" dataKey="model" stroke="#ef4444" dot={false} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Fullscreen Modal Backdrop */}
      {fullscreenPlot && (
        <div className="fixed inset-0 bg-space-950/98 z-50 flex flex-col p-8 justify-between animate-fade-in">
          <div className="flex justify-between items-center mb-6 border-b border-space-800 pb-4">
            <div className="flex items-center space-x-3">
              <ChartIcon className="w-6 h-6 text-indigo-400 animate-pulse" />
              <h2 className="text-xl font-black tracking-wider text-slate-100 uppercase font-mono">
                {fullscreenPlot === 'Raw' && '1. Raw Aperture Photometry'}
                {fullscreenPlot === 'Detrended' && '2. Detrended Light Curve'}
                {fullscreenPlot === 'Periodogram' && '3. BLS Power Spectrum'}
                {fullscreenPlot === 'Folded' && '4. Phase-Folded fit overlay'}
              </h2>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => handleDownload(fullscreenPlot)}
                className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-slate-950 rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export PNG</span>
              </button>
              <button
                onClick={() => setFullscreenPlot(null)}
                className="p-2 hover:bg-space-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer border border-space-800 hover:border-space-700"
                title="Exit Fullscreen"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 bg-space-950 border border-space-850 rounded-xl p-6 flex items-center justify-center min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              {fullscreenPlot === 'Raw' ? (
                <LineChart data={originalCurve} margin={{ top: 20, right: 20, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937/40" horizontal={true} vertical={false} />
                  <XAxis dataKey="time" type="number" domain={['auto', 'auto']} stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'Time (BJD - 2457000)', position: 'insideBottom', offset: -15, fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} domain={['auto', 'auto']} label={{ value: 'Flux (e-/s)', angle: -90, position: 'insideLeft', offset: -12, fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0b0f19', borderColor: '#1f2937', borderRadius: '8px' }} labelStyle={{ color: '#94a3b8' }} />
                  <Legend verticalAlign="top" height={36} iconSize={12} wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                  <Line name="Raw Data" type="monotone" dataKey="flux" stroke="#818cf8" dot={false} strokeWidth={1.5} />
                  <Line name="Baseline Trend" type="monotone" dataKey="baseline" stroke="#ef4444" dot={false} strokeWidth={2} />
                </LineChart>
              ) : fullscreenPlot === 'Detrended' ? (
                <LineChart data={detrendedCurve} margin={{ top: 20, right: 20, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937/40" horizontal={true} vertical={false} />
                  <XAxis dataKey="time" type="number" domain={['auto', 'auto']} stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'Time (BJD - 2457000)', position: 'insideBottom', offset: -15, fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} domain={['auto', 'auto']} label={{ value: 'Detrended Flux (Relative)', angle: -90, position: 'insideLeft', offset: -12, fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0b0f19', borderColor: '#1f2937', borderRadius: '8px' }} labelStyle={{ color: '#94a3b8' }} />
                  <Legend verticalAlign="top" height={36} iconSize={12} wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                  <Line name="Detrended Data" type="monotone" dataKey="flux" stroke="#2dd4bf" dot={false} strokeWidth={1.5} />
                  <Line name="Trapezoid Model" type="monotone" dataKey="model" stroke="#ef4444" dot={false} strokeWidth={2} />
                </LineChart>
              ) : fullscreenPlot === 'Periodogram' ? (
                <AreaChart data={periodogram} margin={{ top: 25, right: 20, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937/40" horizontal={true} vertical={false} />
                  <XAxis 
                    dataKey="period" 
                    type="number"
                    domain={[0.5, 15.0]}
                    ticks={[0.5, 2.0, 4.0, 6.0, 8.0, 10.0, 12.0, 15.0]}
                    stroke="#64748b" 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    label={{ value: 'Trial Period (days)', position: 'insideBottom', offset: -15, fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }} 
                  />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'BLS Power Spectrum', angle: -90, position: 'insideLeft', offset: -12, fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0b0f19', borderColor: '#1f2937', borderRadius: '8px' }} labelStyle={{ color: '#94a3b8' }} />
                  {bestPeriod && (
                    <ReferenceLine 
                      x={bestPeriod} 
                      stroke="#ef4444" 
                      strokeDasharray="4 4" 
                      strokeWidth={2}
                      label={{ value: `Peak: ${bestPeriod.toFixed(4)} d`, fill: '#ef4444', fontSize: 11, position: 'top', fontWeight: 'bold' }} 
                    />
                  )}
                  {bestPeriod && bestPower && (
                    <ReferenceDot 
                      x={bestPeriod} 
                      y={bestPower} 
                      r={6} 
                      fill="#ef4444" 
                      stroke="#ffffff" 
                      strokeWidth={2}
                    />
                  )}
                  <Area type="monotone" dataKey="power" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} dot={false} />
                </AreaChart>
              ) : (
                <LineChart data={foldedCurve} margin={{ top: 20, right: 20, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937/40" horizontal={true} vertical={false} />
                  <XAxis dataKey="phase" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'Orbital Phase', position: 'insideBottom', offset: -15, fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} domain={['auto', 'auto']} label={{ value: 'Normalized Flux', angle: -90, position: 'insideLeft', offset: -12, fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0b0f19', borderColor: '#1f2937', borderRadius: '8px' }} labelStyle={{ color: '#94a3b8' }} />
                  <Legend verticalAlign="top" height={36} iconSize={12} wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                  <Line name="Data" type="monotone" dataKey="flux" stroke="#64748b" dot={{ r: 2.0, fill: '#475569' }} strokeWidth={0} />
                  <Line name="Trapezoid Model" type="monotone" dataKey="model" stroke="#ef4444" dot={false} strokeWidth={3} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
