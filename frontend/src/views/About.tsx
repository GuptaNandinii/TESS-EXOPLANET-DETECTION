import React from 'react';
import { Orbit, Code, Layers } from 'lucide-react';

export const About: React.FC = () => {
  return (
    <div className="pt-24 min-h-screen text-slate-300 px-6 py-12 max-w-4xl mx-auto w-full space-y-12">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-wider text-slate-100">About TESS Exoplanet AI</h1>
        <p className="text-slate-400 max-w-xl mx-auto leading-relaxed">
          Autonomous inference system engineered to identify planetary transit signatures in NASA Transiting Exoplanet Survey Satellite observations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-space-900 border border-space-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-3 border-b border-space-800 pb-3">
            <Orbit className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-slate-200 uppercase tracking-wider text-sm">TESS Mission Overview</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            NASA's Transiting Exoplanet Survey Satellite (TESS) is an all-sky survey mission designed to discover transiting exoplanets ranging from Earth-sized to gas giants, orbiting nearby bright stars. TESS collects high-cadence photometric observations, monitoring light curves across multiple sectors.
          </p>
        </div>

        <div className="bg-space-900 border border-space-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-3 border-b border-space-800 pb-3">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-slate-200 uppercase tracking-wider text-sm">Machine Learning Model</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            The downstream classifier is a pre-trained XGBoost model optimized for multi-class classification. The model ingests a 21-element physical feature vector mapping inputs to three catalog classes: Eclipsing Binaries (EB), false positives caused by stellar noise or background blends, and true planetary candidates (TOIs).
          </p>
        </div>
      </div>

      <div className="bg-space-900 border border-space-800 rounded-xl p-6 shadow-xl space-y-6">
        <div className="flex items-center space-x-3 border-b border-space-800 pb-3">
          <Code className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-slate-200 uppercase tracking-wider text-sm">Technology Infrastructure</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-center">
          {[
            { category: "Frontend Core", value: "React • TypeScript" },
            { category: "Build Engine", value: "Vite" },
            { category: "Scientific Plots", value: "Recharts" },
            { category: "Layout & Theme", value: "Tailwind CSS" },
            { category: "Transitions", value: "Framer Motion" },
            { category: "Inference Engine", value: "Python • XGBoost" }
          ].map((tech, index) => (
            <div key={index} className="bg-space-950 border border-space-850 rounded-lg p-4">
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">{tech.category}</span>
              <span className="block text-xs font-mono font-bold text-slate-200 uppercase">{tech.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center text-[10px] text-slate-650 font-mono w-full border-t border-space-850 pt-8">
        <span>AI-ENABLED TRANSIT DETECTION INFRASTRUCTURE</span>
        <span>VERSION 1.0.0</span>
      </div>
    </div>
  );
};
