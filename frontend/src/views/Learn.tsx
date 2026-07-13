import React from 'react';
import { Activity, ShieldCheck, Database, Filter, Layers, BookOpen } from 'lucide-react';

export const Learn: React.FC = () => {
  const steps = [
    {
      num: "01",
      name: "Raw TESS FITS Reading",
      icon: Database,
      desc: "Loads the primary calibrated HDU from NASA TESS satellite, parsing time, raw aperture flux, flux error estimates, quality flags, and stellar target identifiers."
    },
    {
      num: "02",
      name: "Detrending & Cleaning",
      icon: Filter,
      desc: "Filters out bad-quality cadences (quality flags != 0). Applies a localized Savitzky-Golay high-pass filter (window length = 1001, polyorder = 2) to detrend stellar rotation, spots, and instrument drift."
    },
    {
      num: "03",
      name: "Weighted BLS Transit Sweep",
      icon: Activity,
      desc: "Sweeps a grid of orbital periods (0.5 to 15 days) and transit durations. Uses a Box Least Squares (BLS) algorithm to search for periodic transit dips, returning the best period, epoch, and transit depth."
    },
    {
      num: "04",
      name: "LM Trapezoid Fitting",
      icon: Layers,
      desc: "Folds the light curve around the best orbital parameters. Models the transit shape using a custom 4-parameter trapezoid model. Regresses parameters using Levenberg-Marquardt least-squares optimization."
    },
    {
      num: "05",
      name: "Feature Engineering",
      icon: BookOpen,
      desc: "Computes 14 scientific features: orbital duty cycles, ingress fractions, flat-bottom ratios, shape symmetries (folded left-right RMSE), out-of-transit/in-transit noise parameters, skewness, and kurtosis."
    },
    {
      num: "06",
      name: "XGBoost Classification",
      icon: ShieldCheck,
      desc: "Evaluates the final 21-element feature vector through an ensemble XGBoost classifier trained on vetted targets, mapping outcomes to Planet, Eclipsing Binary, or False Positive classes."
    }
  ];

  return (
    <div className="pt-24 min-h-screen text-slate-300 px-6 py-12 max-w-5xl mx-auto w-full">
      <div className="space-y-4 text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-wider text-slate-100">Pipeline Workflow</h1>
        <p className="text-slate-400 max-w-xl mx-auto leading-relaxed">
          Explore the underlying mathematical and physical stages involved in transit candidate classification, from raw telescope data to automated catalogs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.num}
              className="bg-space-900 border border-space-800 rounded-xl p-6 shadow-xl relative overflow-hidden group hover:border-space-700 transition-all duration-300"
            >
              <div className="absolute top-4 right-4 text-3xl font-mono font-black text-space-800/40 select-none group-hover:text-indigo-500/10 transition-colors">
                {step.num}
              </div>

              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-200 uppercase tracking-wider text-sm">
                  {step.name}
                </h3>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {step.desc}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-12 bg-space-900 border border-space-800 rounded-xl p-6 shadow-xl text-center">
        <h3 className="font-bold text-slate-200 uppercase tracking-wider text-sm mb-3">Model Cataloging Matrix</h3>
        <p className="text-xs text-slate-400 leading-relaxed max-w-2xl mx-auto mb-4">
          The engineered metrics are correlated to detect physical artifacts (e.g. secondary eclipses indicating binaries, high RMSE residuals representing asymmetric stellar spots/flares, and high-SNR flat bottom dips signaling transiting exoplanets).
        </p>
        <div className="inline-flex space-x-4 text-xs font-mono font-bold text-indigo-400">
          <span>01. Planet</span>
          <span>•</span>
          <span>02. Eclipsing Binary</span>
          <span>•</span>
          <span>03. False Positive / Blend</span>
        </div>
      </div>
    </div>
  );
};
