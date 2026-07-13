import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, Hourglass } from 'lucide-react';

export interface PipelineStep {
  id: string;
  name: string;
  description: string;
  status: 'waiting' | 'active' | 'completed';
}

interface ProcessingFlowProps {
  steps: PipelineStep[];
}

export const ProcessingFlow: React.FC<ProcessingFlowProps> = ({ steps }) => {
  return (
    <div className="bg-space-900 border border-space-800 rounded-xl p-6 shadow-xl max-w-xl mx-auto w-full">
      <h2 className="text-xl font-bold tracking-wider text-slate-100 uppercase mb-6 flex items-center space-x-2 border-b border-space-800 pb-3">
        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
        <span>AI Inference Pipeline Execution</span>
      </h2>

      <div className="relative flex flex-col space-y-8 pl-4">
        {/* Vertical line indicator */}
        <div className="absolute left-7 top-2 bottom-2 w-0.5 bg-space-800 -z-10" />

        <AnimatePresence>
          {steps.map((step, idx) => {
            const isCompleted = step.status === 'completed';
            const isActive = step.status === 'active';
            
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.1 }}
                className="flex items-start space-x-4 relative"
              >
                {/* Stage Icon status indicator */}
                <div className="relative flex items-center justify-center">
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="bg-space-950 rounded-full z-10 p-0.5"
                    >
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 fill-emerald-950/40" />
                    </motion.div>
                  ) : isActive ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      className="bg-indigo-950/60 border border-indigo-400 rounded-full z-10 p-1"
                    >
                      <Loader2 className="w-4 h-4 text-indigo-400" />
                    </motion.div>
                  ) : (
                    <div className="bg-space-950 border border-space-800 rounded-full z-10 p-1 text-slate-600">
                      <Hourglass className="w-4 h-4" />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm font-bold uppercase tracking-wider ${
                      isActive ? 'text-indigo-400 font-semibold' : isCompleted ? 'text-emerald-400' : 'text-slate-500'
                    }`}>
                      {step.name}
                    </span>
                    {isActive && (
                      <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full font-bold uppercase animate-pulse">
                        Processing
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
