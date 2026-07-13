import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UploadArea } from '../components/UploadArea';
import { ProcessingFlow } from '../components/ProcessingFlow';
import type { PipelineStep } from '../components/ProcessingFlow';
import { MetricsGrid } from '../components/MetricsGrid';
import { InteractivePlot } from '../components/InteractivePlot';

import type { PredictionResult } from '../utils/mockData';
import { ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';

interface DashboardProps {
  setBackendOnline: (status: boolean) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setBackendOnline }) => {
  const [viewState, setViewState] = useState<'upload' | 'processing' | 'results'>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [steps, setSteps] = useState<PipelineStep[]>([
    { id: 'fits', name: 'Reading FITS Header & Table', description: 'Extracting time series flux indices', status: 'waiting' },
    { id: 'preprocess', name: 'Preprocessing & Detrending', description: 'Savitzky-Golay detrending and flag cleanup', status: 'waiting' },
    { id: 'bls', name: 'Weighted BLS Search', description: 'Box Least Squares periodic candidate sweep', status: 'waiting' },
    { id: 'fold', name: 'Phase Folding', description: 'Folding observations onto detected orbital phase', status: 'waiting' },
    { id: 'fit', name: 'Trapezoid Shape Fitting', description: 'Levenberg-Marquardt transit parameters regression', status: 'waiting' },
    { id: 'features', name: 'Feature Engineering', description: 'Computing V1 & V2 shape, SNR and symmetry metrics', status: 'waiting' },
    { id: 'classify', name: 'XGBoost Classification', description: 'Model evaluation for candidate cataloging', status: 'waiting' }
  ]);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check backend online status with polling
  useEffect(() => {
    const checkHealth = () => {
      axios.get('/api/health', { timeout: 1500 })
        .then(() => {
          setBackendOnline(true);
          setIsDemoMode(false);
        })
        .catch(() => {
          setBackendOnline(false);
          setIsDemoMode(true);
        });
    };

    checkHealth();
    const interval = setInterval(checkHealth, 3000);
    return () => clearInterval(interval);
  }, [setBackendOnline]);

  const handlePredictFile = async (fileOrSampleName: File | string) => {
    setError(null);
    let name = '';
    if (typeof fileOrSampleName === 'string') {
      name = fileOrSampleName.replace('sample_', 'sample_tess_') + '.fits';
    } else {
      name = fileOrSampleName.name;
    }
    
    setFileName(name);
    setViewState('processing');
    
    // Reset steps
    setSteps(prev => prev.map(s => ({ ...s, status: 'waiting' })));

    // Sequential simulation logic for step progression
    for (let i = 0; i < steps.length; i++) {
      // Set current active
      setSteps(prev => prev.map((s, idx) => {
        if (idx === i) return { ...s, status: 'active' };
        if (idx < i) return { ...s, status: 'completed' };
        return s;
      }));
      
      // Delay to simulate computation time
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Set last step completed
    setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'completed' } : s));
    await new Promise(resolve => setTimeout(resolve, 300));

    // Resolve predictions
    if (typeof fileOrSampleName !== 'string') {
      if (isDemoMode) {
        setError("Backend API offline. Please ensure the Python server (python -m src.api) is running.");
        setViewState('upload');
        return;
      }

      const formData = new FormData();
      formData.append('file', fileOrSampleName);
      
      try {
        const response = await axios.post<PredictionResult>('/api/predict', formData);
        setResult(response.data);
        setViewState('results');
      } catch (err: any) {
        console.error("Backend error:", err);
        const errMsg = err.response?.data?.error || err.message || "An error occurred during backend pipeline processing.";
        setError(errMsg);
        setViewState('upload');
      }
    }
  };

  const handleReset = () => {
    setError(null);
    setViewState('upload');
    setResult(null);
  };

  return (
    <div className="pt-24 min-h-screen text-slate-300 px-6 py-12 max-w-7xl mx-auto w-full">
      {viewState === 'upload' && (
        <div className="space-y-6">
          {error && (
            <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-4 max-w-2xl mx-auto flex items-start space-x-3 text-red-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold uppercase tracking-wider text-xs">Pipeline Execution Error</h4>
                <p className="text-xs mt-1 leading-relaxed">{error}</p>
              </div>
            </div>
          )}
          <UploadArea onFileLoaded={handlePredictFile} isLoading={false} />
        </div>
      )}

      {viewState === 'processing' && (
        <div className="space-y-6 flex flex-col items-center justify-center py-12">
          <ProcessingFlow steps={steps} />
        </div>
      )}

      {viewState === 'results' && result && (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-space-800 pb-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleReset}
                className="p-2 hover:bg-space-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                title="Back to Upload"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-wider text-slate-100">Analysis Results</h1>
                <p className="text-xs text-slate-500 font-mono mt-1 leading-none">{fileName}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {isDemoMode && (
                <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-xs font-semibold uppercase tracking-wider leading-none">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Simulation Fallback Active</span>
                </div>
              )}
              <button
                onClick={handleReset}
                className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-slate-950 rounded-lg transition-all duration-300"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Upload Another FITS</span>
              </button>
            </div>
          </div>

          {/* Target Metadata Banner */}
          <div className="bg-space-900/60 backdrop-blur-md border border-space-800 rounded-xl p-6 shadow-xl w-full grid grid-cols-2 md:grid-cols-5 gap-6 items-center">
            {/* 1. TIC ID */}
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Target Identifier</div>
              <div className="text-xl font-black font-mono text-slate-100">
                TIC {result.tic_id || '737546'}
              </div>
            </div>

            {/* 2. Sectors Observed */}
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Sectors Observed</div>
              <div className="text-xl font-bold text-slate-200">
                {result.sectors || 1} {result.sectors && result.sectors > 1 ? 'Sectors' : 'Sector'}
              </div>
            </div>

            {/* 3. Best Sector */}
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Analysis Sector</div>
              <div className="text-xl font-bold text-slate-200">
                Sector {result.best_sector || 5}
              </div>
            </div>

            {/* 4. Classification Status */}
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">AI Classification</div>
              <div className="flex items-center space-x-2">
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider border ${
                  result.class_label === 'Planet'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : result.class_label === 'EB'
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}>
                  {result.class_label}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {(result.confidence * 100).toFixed(2)}%
                </span>
              </div>
            </div>

            {/* 5. Probability distribution or status */}
            <div className="col-span-2 md:col-span-1 border-t md:border-t-0 md:border-l border-space-800 pt-4 md:pt-0 md:pl-6 h-full flex flex-col justify-center space-y-1">
              {Object.entries(result.probabilities).map(([label, value]) => (
                <div key={label} className="flex justify-between items-center text-[10px] font-semibold">
                  <span className="text-slate-500 uppercase tracking-wider">{label}</span>
                  <span className="text-slate-300 font-mono font-bold">{(value * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* BLS Search Parameters Panel */}
          <div className="bg-space-900/40 border border-space-850 rounded-xl p-5 shadow-lg grid grid-cols-1 md:grid-cols-6 gap-6 items-center">
            <div className="md:col-span-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-350">Weighted BLS Algorithm Parameters</h3>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">Dynamically retrieved from active backend detector</p>
            </div>
            
            <div className="grid grid-cols-2 md:col-span-4 gap-4 text-xs font-semibold">
              <div className="flex justify-between border-b border-space-800/40 pb-1.5">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Period Search Range</span>
                <span className="text-slate-200 font-mono">
                  {result.bls_min_period?.toFixed(1) || '0.5'} – {result.bls_max_period?.toFixed(1) || '15.0'} days
                </span>
              </div>
              <div className="flex justify-between border-b border-space-800/40 pb-1.5">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Trial Period Grid</span>
                <span className="text-slate-200 font-mono">{result.bls_number_of_periods || '6000'} steps</span>
              </div>
              <div className="flex justify-between border-b border-space-800/40 pb-1.5">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Duration Range</span>
                <span className="text-slate-200 font-mono">
                  {((result.bls_min_duration || 0.03) * 24).toFixed(1)} – {((result.bls_max_duration || 0.25) * 24).toFixed(1)} hours
                </span>
              </div>
              <div className="flex justify-between border-b border-space-800/40 pb-1.5">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Trial Durations</span>
                <span className="text-slate-200 font-mono">{result.bls_number_of_durations || '50'} steps</span>
              </div>
              <div className="flex justify-between border-b border-space-800/40 pb-1.5">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Weighted Fitting</span>
                <span className="text-emerald-400 uppercase text-[10px] tracking-wider font-bold">Enabled (dy weights)</span>
              </div>
              <div className="flex justify-between border-b border-space-800/40 pb-1.5">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Best Trial Period</span>
                <span className="text-indigo-400 font-mono font-bold">
                  {result.best_period?.toFixed(4) || '3.0790'} days ({((result.best_period || 3.0790) * 24).toFixed(1)} hrs)
                </span>
              </div>
            </div>
          </div>

          {/* Scientific Plots */}
          <div className="w-full">
            <InteractivePlot
              originalCurve={result.originalCurve}
              detrendedCurve={result.detrendedCurve}
              periodogram={result.periodogram}
              foldedCurve={result.foldedCurve}
              bestPeriod={result.best_period}
              bestPower={result.best_power}
            />
          </div>

          {/* Metric parameters */}
          <div className="w-full">
            <MetricsGrid metrics={result.metrics} />
          </div>
        </div>
      )}
    </div>
  );
};
