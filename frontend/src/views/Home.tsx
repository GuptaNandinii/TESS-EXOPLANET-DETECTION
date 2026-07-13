import React from 'react';
import { Cpu, ChevronRight } from 'lucide-react';

interface HomeProps {
  setView: (view: string) => void;
}

export const Home: React.FC<HomeProps> = ({ setView }) => {
  return (
    <div className="pt-24 min-h-screen text-slate-300 flex flex-col justify-between">
      <div className="max-w-6xl mx-auto px-6 py-12 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 text-xs text-indigo-400 font-bold uppercase tracking-widest leading-none">
              <Cpu className="w-3.5 h-3.5" />
              <span>AI-Assisted Transit Photometry</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl font-black text-slate-100 uppercase tracking-tight leading-tight">
              AI-Enabled Exoplanet Detection from <span className="text-indigo-400">TESS Light Curves</span>
            </h1>
            
            <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-xl">
              An automated, end-to-end scientific inference platform that extracts light curves from TESS FITS files, processes noise, detects transits via Box Least Squares (BLS), fits trapezoidal shapes, and classifies stars using a pre-trained XGBoost model.
            </p>

            <div className="flex space-x-4">
              <button
                onClick={() => setView('dashboard')}
                className="inline-flex items-center space-x-2 bg-indigo-500 hover:bg-indigo-600 text-slate-950 hover:text-slate-950 font-bold uppercase tracking-wider text-sm py-3 px-6 rounded-lg transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.4)]"
              >
                <span>Launch Analyzer</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => setView('pipeline')}
                className="inline-flex items-center space-x-2 bg-space-900 hover:bg-space-850 border border-space-850 text-slate-200 font-bold uppercase tracking-wider text-sm py-3 px-6 rounded-lg transition-all duration-300"
              >
                <span>Workflow Details</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 relative flex items-center justify-center">
            {/* Animated space background decoration */}
            <div className="absolute inset-0 bg-indigo-500/5 rounded-full filter blur-3xl -z-10 animate-pulse" />
            <div className="border border-space-800 bg-space-950/60 p-8 rounded-2xl max-w-md w-full shadow-2xl relative">
              <div className="absolute -top-3 -left-3 w-6 h-6 border-t-2 border-l-2 border-indigo-400" />
              <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b-2 border-r-2 border-indigo-400" />
              
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 mb-4 border-b border-space-800 pb-2">
                Pipeline Stages
              </h3>
              
              <div className="space-y-4">
                {[
                  { stage: "01 / Calibrated FITS", desc: "Extracting scientific flux data" },
                  { stage: "02 / Preprocessing", desc: "Savitzky-Golay detrending and flag filters" },
                  { stage: "03 / BLS Detection", desc: "Weighted Box Least Squares periodic search" },
                  { stage: "04 / Shape Fitting", desc: "Levenberg-Marquardt trapezoid regression" },
                  { stage: "05 / XGBoost Classification", desc: "Multi-class exoplanet candidate prediction" }
                ].map((item, index) => (
                  <div key={index} className="flex justify-between items-center text-xs">
                    <span className="font-mono font-bold text-indigo-400">{item.stage}</span>
                    <span className="text-slate-400 text-right">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 border-t border-space-850 w-full text-center text-xs text-slate-500 font-mono">
        <span>TESS AI EXOPLANET PIPELINE • INSTRUMENT INFRASTRUCTURE DETECTOR</span>
      </div>
    </div>
  );
};
