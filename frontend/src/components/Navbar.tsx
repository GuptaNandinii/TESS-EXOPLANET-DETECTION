import React from 'react';
import { Orbit, Activity, Info, BookOpen } from 'lucide-react';

interface NavbarProps {
  currentView: string;
  setView: (view: string) => void;
  backendOnline: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, setView, backendOnline }) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-space-950 border-b border-space-800 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setView('home')}>
        <Orbit className="w-8 h-8 text-indigo-400 animate-pulse" />
        <div>
          <span className="font-bold text-xl tracking-wider text-slate-100 uppercase">TESS Exoplanet AI</span>
          <span className="block text-xs text-indigo-400 uppercase tracking-widest font-semibold">Inference Pipeline</span>
        </div>
      </div>

      <div className="flex items-center space-x-8">
        {[
          { id: 'home', label: 'Home', icon: Orbit },
          { id: 'dashboard', label: 'Dashboard', icon: Activity },
          { id: 'pipeline', label: 'Workflow', icon: BookOpen },
          { id: 'about', label: 'About Project', icon: Info }
        ].map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex items-center space-x-2 text-sm uppercase tracking-wider font-semibold transition-all duration-300 ${
                isActive
                  ? 'text-indigo-400 border-b-2 border-indigo-400 pb-1'
                  : 'text-slate-400 hover:text-slate-200 pb-1'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center space-x-3 bg-space-900 border border-space-800 rounded-full px-4 py-1.5">
        <div className={`w-2.5 h-2.5 rounded-full ${backendOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'}`} />
        <span className="text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase">
          {backendOnline ? 'Backend Connected' : 'Simulation Mode'}
        </span>
      </div>
    </nav>
  );
};
