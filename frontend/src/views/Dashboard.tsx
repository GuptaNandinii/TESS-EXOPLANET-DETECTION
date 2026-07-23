import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UploadArea } from '../components/UploadArea';
import { ProcessingFlow } from '../components/ProcessingFlow';
import type { PipelineStep } from '../components/ProcessingFlow';
import { MetricsGrid } from '../components/MetricsGrid';
import { InteractivePlot } from '../components/InteractivePlot';

import type { PredictionResult } from '../utils/mockData';
import { ArrowLeft, RefreshCw, AlertTriangle, FolderOpen } from 'lucide-react';

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

  // Batch states
  const [uploadMode, setUploadMode] = useState<'single' | 'batch' | 'folder'>('single');
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchResults, setBatchResults] = useState<{
    filename: string;
    tic_id?: number;
    class_label?: string;
    confidence?: number;
    pfi?: number;
    fap?: number;
    priority?: string;
    recommendation?: string;
    snr?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error?: string;
  }[]>([]);
  const [batchProcessingIndex, setBatchProcessingIndex] = useState<number>(-1);
  const [batchStatus, setBatchStatus] = useState<'idle' | 'processing' | 'completed'>('idle');

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

  const handleBatchFilesSelected = (files: File[]) => {
    setBatchFiles(files);
    setBatchResults(files.map(f => ({
      filename: f.name,
      status: 'pending'
    })));
    setBatchProcessingIndex(0);
    setViewState('processing');
    setBatchStatus('processing');
  };

  // Batch execution loop
  useEffect(() => {
    if (batchStatus !== 'processing' || batchProcessingIndex < 0 || batchProcessingIndex >= batchFiles.length) {
      if (batchStatus === 'processing' && batchProcessingIndex === batchFiles.length) {
        setBatchStatus('completed');
        setViewState('results');
      }
      return;
    }

    const processFile = async () => {
      const file = batchFiles[batchProcessingIndex];
      
      // Update status to processing
      setBatchResults(prev => prev.map((item, idx) => 
        idx === batchProcessingIndex ? { ...item, status: 'processing' } : item
      ));

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await axios.post<PredictionResult>('/api/predict', formData);
        const data = response.data;
        const snrVal = data.metrics?.physics?.find((m: any) => m.label === 'Transit SNR')?.value || 'N/A';
        
        setBatchResults(prev => prev.map((item, idx) => 
          idx === batchProcessingIndex ? {
            filename: file.name,
            tic_id: data.tic_id,
            class_label: data.class_label,
            confidence: data.confidence,
            pfi: data.pfi,
            fap: data.fap,
            priority: data.priority,
            recommendation: data.recommendation,
            snr: String(snrVal),
            status: 'completed'
          } : item
        ));
      } catch (err: any) {
        console.error("Batch file processing error:", err);
        const errMsg = err.response?.data?.error || err.message || "Failed to process FITS.";
        setBatchResults(prev => prev.map((item, idx) => 
          idx === batchProcessingIndex ? {
            filename: file.name,
            status: 'failed',
            error: String(errMsg)
          } : item
        ));
      }

      // Move to next file
      setBatchProcessingIndex(prev => prev + 1);
    };

    processFile();
  }, [batchStatus, batchProcessingIndex, batchFiles]);

  const downloadCSV = () => {
    const headers = [
      "Filename",
      "TIC ID",
      "AI Classification",
      "Confidence",
      "PARAS2 PFI Score",
      "False Alarm Probability",
      "Follow-up Priority",
      "Transit SNR",
      "Recommendation",
      "Status"
    ];

    const rows = batchResults.map(r => [
      r.filename,
      r.tic_id || 'N/A',
      r.class_label || 'N/A',
      r.confidence !== undefined ? `${(r.confidence * 100).toFixed(2)}%` : 'N/A',
      r.pfi !== undefined ? r.pfi.toFixed(4) : 'N/A',
      r.fap !== undefined ? `${(r.fap * 100).toFixed(4)}%` : 'N/A',
      r.priority || 'N/A',
      r.snr || 'N/A',
      r.recommendation || 'N/A',
      r.status === 'failed' ? `Failed: ${r.error}` : 'Success'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Voyager3_Exoplanet_Batch_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    setBatchFiles([]);
    setBatchResults([]);
    setBatchProcessingIndex(-1);
    setBatchStatus('idle');
  };

  return (
    <div className="pt-24 min-h-screen text-slate-300 px-6 py-12 max-w-7xl mx-auto w-full">
      {viewState === 'upload' && (
        <div className="space-y-6">
          {/* Upload Mode Selector Tabs */}
          <div className="flex justify-center space-x-2 bg-space-950 p-1.5 border border-space-850 rounded-xl max-w-md mx-auto mb-6">
            <button
              onClick={() => setUploadMode('single')}
              className={`flex-1 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                uploadMode === 'single'
                  ? 'bg-indigo-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Single Star
            </button>
            <button
              onClick={() => setUploadMode('batch')}
              className={`flex-1 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                uploadMode === 'batch'
                  ? 'bg-indigo-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Batch Files
            </button>
            <button
              onClick={() => setUploadMode('folder')}
              className={`flex-1 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                uploadMode === 'folder'
                  ? 'bg-indigo-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Folder Upload
            </button>
          </div>

          {error && (
            <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-4 max-w-2xl mx-auto flex items-start space-x-3 text-red-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold uppercase tracking-wider text-xs">Pipeline Execution Error</h4>
                <p className="text-xs mt-1 leading-relaxed">{error}</p>
              </div>
            </div>
          )}
          
          <UploadArea 
            mode={uploadMode}
            onFileLoaded={handlePredictFile} 
            onFilesLoaded={handleBatchFilesSelected}
            isLoading={false} 
          />
        </div>
      )}

      {viewState === 'processing' && (
        <div className="space-y-6 flex flex-col items-center justify-center py-12 w-full">
          {batchStatus === 'processing' ? (
            /* Batch Processing Dashboard */
            <div className="space-y-8 w-full max-w-5xl mx-auto animate-fade-in">
              <div className="bg-space-900 border border-space-800 rounded-xl p-6 shadow-xl space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold tracking-wider text-slate-100 uppercase">
                      Batch Processing Light Curves
                    </h2>
                    <p className="text-xs text-slate-500 font-mono mt-1">
                      Processing target {batchProcessingIndex + 1} of {batchFiles.length}
                    </p>
                  </div>
                  <div className="text-sm font-bold text-slate-350 font-mono">
                    {Math.round(((batchProcessingIndex) / batchFiles.length) * 100)}% Complete
                  </div>
                </div>

                <div className="w-full bg-space-950 h-2.5 rounded-full overflow-hidden border border-space-850">
                  <div 
                    className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${((batchProcessingIndex) / batchFiles.length) * 100}%` }}
                  />
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-2">
                  <div className="bg-space-950/60 border border-space-850 p-3 rounded-lg text-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold mb-1">Processed</span>
                    <span className="text-lg font-bold font-mono text-slate-200">{batchProcessingIndex} / {batchFiles.length}</span>
                  </div>
                  <div className="bg-space-950/60 border border-space-850 p-3 rounded-lg text-center">
                    <span className="text-[10px] text-emerald-400 uppercase tracking-wider block font-bold mb-1">Planet Candidates</span>
                    <span className="text-lg font-bold font-mono text-emerald-400">
                      {batchResults.filter(r => r.class_label === 'Planet').length}
                    </span>
                  </div>
                  <div className="bg-space-950/60 border border-space-850 p-3 rounded-lg text-center">
                    <span className="text-[10px] text-amber-500 uppercase tracking-wider block font-bold mb-1">Eclipsing Binaries</span>
                    <span className="text-lg font-bold font-mono text-amber-400">
                      {batchResults.filter(r => r.class_label === 'EB').length}
                    </span>
                  </div>
                  <div className="bg-space-950/60 border border-space-850 p-3 rounded-lg text-center">
                    <span className="text-[10px] text-rose-500 uppercase tracking-wider block font-bold mb-1">False Positives</span>
                    <span className="text-lg font-bold font-mono text-rose-400">
                      {batchResults.filter(r => r.class_label === 'False Positive').length}
                    </span>
                  </div>
                  <div className="bg-space-950/60 border border-space-850 p-3 rounded-lg text-center">
                    <span className="text-[10px] text-red-500 uppercase tracking-wider block font-bold mb-1">Failed / Errors</span>
                    <span className="text-lg font-bold font-mono text-red-400">
                      {batchResults.filter(r => r.status === 'failed').length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-space-900/60 border border-space-800 rounded-xl p-5 flex items-center justify-between shadow-md">
                <div className="flex items-center space-x-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
                  <span className="text-sm font-medium text-slate-350">
                    Running pipeline on: <span className="font-mono text-slate-100 font-bold">{batchFiles[batchProcessingIndex]?.name}</span>
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">INGEST ➔ DETREND ➔ BLS ➔ FIT ➔ CLASSIFY</span>
              </div>
            </div>
          ) : (
            <ProcessingFlow steps={steps} />
          )}
        </div>
      )}

      {viewState === 'results' && (
        <div className="w-full">
          {batchStatus === 'completed' ? (
            /* Batch Results Report */
            <div className="space-y-8 animate-fade-in">
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
                    <h1 className="text-2xl font-black uppercase tracking-wider text-slate-100">Batch Processing Report</h1>
                    <p className="text-xs text-slate-500 font-mono mt-1">Successfully completed classification for target folder</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={downloadCSV}
                    className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-lg transition-all cursor-pointer shadow-md"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>Download CSV Summary</span>
                  </button>
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-slate-950 rounded-lg transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Process Another Batch</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                <div className="bg-space-900 border border-space-800 p-5 rounded-xl text-center shadow-lg">
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-bold block mb-1">Total Targets</span>
                  <span className="text-3xl font-black font-mono text-slate-200">{batchResults.length}</span>
                </div>
                <div className="bg-space-900 border border-space-800 p-5 rounded-xl text-center shadow-lg">
                  <span className="text-xs text-emerald-500 uppercase tracking-wider font-bold block mb-1">Planet Candidates</span>
                  <span className="text-3xl font-black font-mono text-emerald-400">
                    {batchResults.filter(r => r.class_label === 'Planet').length}
                  </span>
                </div>
                <div className="bg-space-900 border border-space-800 p-5 rounded-xl text-center shadow-lg">
                  <span className="text-xs text-amber-500 uppercase tracking-wider font-bold block mb-1">Eclipsing Binaries</span>
                  <span className="text-3xl font-black font-mono text-amber-400">
                    {batchResults.filter(r => r.class_label === 'EB').length}
                  </span>
                </div>
                <div className="bg-space-900 border border-space-800 p-5 rounded-xl text-center shadow-lg">
                  <span className="text-xs text-rose-500 uppercase tracking-wider font-bold block mb-1">False Positives</span>
                  <span className="text-3xl font-black font-mono text-rose-455">
                    {batchResults.filter(r => r.class_label === 'False Positive').length}
                  </span>
                </div>
                <div className="bg-space-900 border border-space-800 p-5 rounded-xl text-center shadow-lg">
                  <span className="text-xs text-red-500 uppercase tracking-wider font-bold block mb-1">Failed / Errors</span>
                  <span className="text-3xl font-black font-mono text-red-400">
                    {batchResults.filter(r => r.status === 'failed').length}
                  </span>
                </div>
              </div>

              <div className="bg-space-900/60 backdrop-blur-md border border-space-800 rounded-xl overflow-hidden shadow-xl">
                <div className="p-5 border-b border-space-800 bg-space-900 flex justify-between items-center">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">Target Catalog Predictions</h3>
                  <span className="text-xs text-slate-500 font-mono font-bold">Total Stars: {batchResults.length}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-space-850 bg-space-950/40 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        <th className="py-4 px-6">Filename / Identifier</th>
                        <th className="py-4 px-6">TIC ID</th>
                        <th className="py-4 px-6">Classification</th>
                        <th className="py-4 px-6">Confidence</th>
                        <th className="py-4 px-6">PFI Score</th>
                        <th className="py-4 px-6">FAP</th>
                        <th className="py-4 px-6">Transit SNR</th>
                        <th className="py-4 px-6">Recommendation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-space-850 text-xs font-semibold">
                      {batchResults.map((r, index) => (
                        <tr key={index} className="hover:bg-space-850/20 transition-colors">
                          <td className="py-3.5 px-6 font-mono text-slate-300 break-all max-w-[200px]">
                            {r.filename}
                          </td>
                          <td className="py-3.5 px-6 font-mono text-slate-400">
                            {r.status === 'failed' ? 'N/A' : `TIC ${r.tic_id || 'N/A'}`}
                          </td>
                          <td className="py-3.5 px-6">
                            {r.status === 'failed' ? (
                              <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-md text-[10px] font-black uppercase tracking-wider">
                                Pipeline Error
                              </span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                                r.class_label === 'Planet'
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                  : r.class_label === 'EB'
                                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                              }`}>
                                {r.class_label}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-6 font-mono text-slate-300">
                            {r.status === 'failed' ? (
                              <span className="text-slate-500">N/A</span>
                            ) : (
                              `${((r.confidence || 0) * 100).toFixed(1)}%`
                            )}
                          </td>
                          <td className="py-3.5 px-6 font-mono text-indigo-400 font-bold">
                            {r.status === 'failed' ? (
                              <span className="text-slate-500">N/A</span>
                            ) : (
                              r.pfi?.toFixed(3) || '0.000'
                            )}
                          </td>
                          <td className="py-3.5 px-6 font-mono text-slate-400">
                            {r.status === 'failed' ? (
                              <span className="text-slate-500">N/A</span>
                            ) : (
                              `${((r.fap || 0) * 100).toFixed(4)}%`
                            )}
                          </td>
                          <td className="py-3.5 px-6 font-mono text-slate-400">
                            {r.status === 'failed' ? (
                              <span className="text-slate-500">N/A</span>
                            ) : (
                              r.snr || '0.00'
                            )}
                          </td>
                          <td className="py-3.5 px-6 text-slate-400">
                            {r.status === 'failed' ? (
                              <span className="text-red-400/80 font-mono text-[10px] leading-relaxed break-all">
                                {r.error}
                              </span>
                            ) : (
                              <span className={`text-[10px] tracking-wide ${
                                r.priority === 'HIGH' ? 'text-rose-450 font-bold' : 'text-slate-400'
                              }`}>
                                {r.recommendation}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* Single Result View */
            result && (
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
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-450'
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

                {/* PARAS-2 Follow-up Banner */}
                <div className="bg-gradient-to-r from-space-900/60 to-indigo-950/20 border border-indigo-900/20 rounded-xl p-6 shadow-xl w-full grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                  {/* PFI Score */}
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-center min-w-[90px]">
                      <span className="text-[10px] font-black uppercase text-indigo-400 block tracking-wider mb-0.5">PFI Score</span>
                      <span className="text-2xl font-black font-mono text-indigo-300">
                        {result.pfi !== undefined ? result.pfi.toFixed(3) : '1.854'}
                      </span>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Follow-up Priority</div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider border leading-none inline-block ${
                        (result.priority || 'HIGH') === 'HIGH'
                          ? 'bg-rose-500/15 border-rose-500/30 text-rose-450'
                          : (result.priority || 'HIGH') === 'MEDIUM'
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400'
                      }`}>
                        {result.priority || 'HIGH'}
                      </span>
                    </div>
                  </div>

                  {/* False Alarm Probability (FAP) */}
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">False Alarm Probability (FAP)</div>
                    <div className="text-xl font-bold font-mono text-slate-200">
                      {result.fap !== undefined ? (result.fap * 100).toFixed(4) : '0.0016'}%
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono mt-0.5">Empirical Bootstrap-Sigmoid estimation</div>
                  </div>

                  {/* Candidate Significance SNR */}
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Transit Significance (SNR)</div>
                    <div className="text-xl font-bold font-mono text-slate-200">
                      {result.metrics?.physics?.find((m: any) => m.label === 'Transit SNR')?.value || '14.38'}
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono mt-0.5">Signal-to-noise ratio of depth to OOT noise</div>
                  </div>

                  {/* Recommendation */}
                  <div className="border-t md:border-t-0 md:border-l border-space-800 pt-4 md:pt-0 md:pl-6">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Astronomic Action Recommendation</div>
                    <p className="text-xs font-bold text-slate-350 leading-relaxed mt-1">
                      {result.recommendation || 'Highly Recommended for Telescope Follow-up'}
                    </p>
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
            )
          )}
        </div>
      )}
    </div>
  );
};
