export interface MetricItem {
  label: string;
  value: string | number;
  description: string;
}

export interface PredictionResult {
  tic_id?: number;
  sectors?: number;
  best_sector?: number;
  best_period?: number;
  best_power?: number;
  bls_min_period?: number;
  bls_max_period?: number;
  bls_number_of_periods?: number;
  bls_number_of_durations?: number;
  bls_min_duration?: number;
  bls_max_duration?: number;
  class_label: string;
  confidence: number;
  probabilities: {
    Planet: number;
    EB: number;
    "False Positive": number;
  };
  metrics: {
    bls: MetricItem[];
    transit: MetricItem[];
    physics: MetricItem[];
  };
  originalCurve: { time: number; flux: number }[];
  detrendedCurve: { time: number; flux: number }[];
  periodogram: { period: number; power: number }[];
  foldedCurve: { phase: number; flux: number; model: number }[];
}

// Helper to generate a light curve with noise and transits
const generateOriginalCurve = (period: number, depth: number, duration: number, isEB: boolean = false) => {
  const points = [];
  const totalPoints = 500;
  const tStart = 1354.0;
  const tEnd = 1365.0;
  
  for (let i = 0; i < totalPoints; i++) {
    const time = tStart + (i / totalPoints) * (tEnd - tStart);
    // Base flux
    let flux = 10000.0;
    
    // Add transit dip
    const phase = ((time - tStart) % period) / period;
    const normPhase = phase > 0.5 ? phase - 1.0 : phase;
    
    const halfDur = (duration / period) / 2;
    if (Math.abs(normPhase) <= halfDur) {
      // Primary dip
      const factor = 1.0 - (depth * (1 - Math.pow(normPhase / halfDur, 2) * 0.1));
      flux *= factor;
    } else if (isEB && Math.abs(Math.abs(normPhase) - 0.5) <= halfDur) {
      // Secondary dip for EB
      flux *= (1.0 - depth * 0.4);
    }
    
    // Add low-frequency stellar variability (sine wave)
    flux += Math.sin(time * 2.0) * 15.0;
    
    // Add high-frequency white noise
    flux += (Math.random() - 0.5) * 8.0;
    
    points.push({ time: parseFloat(time.toFixed(4)), flux: parseFloat(flux.toFixed(2)) });
  }
  
  return points;
};

const generateDetrendedCurve = (period: number, depth: number, duration: number, isEB: boolean = false) => {
  const points = [];
  const totalPoints = 500;
  const tStart = 1354.0;
  const tEnd = 1365.0;
  
  for (let i = 0; i < totalPoints; i++) {
    const time = tStart + (i / totalPoints) * (tEnd - tStart);
    let flux = 1.0;
    
    const phase = ((time - tStart) % period) / period;
    const normPhase = phase > 0.5 ? phase - 1.0 : phase;
    const halfDur = (duration / period) / 2;
    
    if (Math.abs(normPhase) <= halfDur) {
      flux -= depth;
    } else if (isEB && Math.abs(Math.abs(normPhase) - 0.5) <= halfDur) {
      flux -= depth * 0.4;
    }
    
    // White noise only (variability detrended out)
    flux += (Math.random() - 0.5) * 0.0008;
    
    points.push({ time: parseFloat(time.toFixed(4)), flux: parseFloat(flux.toFixed(5)) });
  }
  return points;
};

const generatePeriodogram = (bestPeriod: number) => {
  const points = [];
  const steps = 300;
  const pMin = 0.5;
  const pMax = 10.0;
  
  for (let i = 0; i < steps; i++) {
    const period = pMin + (i / steps) * (pMax - pMin);
    let power = Math.random() * 20.0;
    
    // Peak at best period
    if (Math.abs(period - bestPeriod) < 0.1) {
      power += 450.0 / (1.0 + Math.pow((period - bestPeriod) / 0.05, 2));
    }
    // Alias peaks
    if (Math.abs(period - bestPeriod * 2) < 0.2 || Math.abs(period - bestPeriod / 2) < 0.05) {
      power += 150.0 / (1.0 + Math.pow((period - (bestPeriod * 2)) / 0.1, 2));
    }
    
    points.push({ period: parseFloat(period.toFixed(3)), power: parseFloat(power.toFixed(2)) });
  }
  return points.sort((a, b) => a.period - b.period);
};

const generateFoldedCurve = (depth: number, durationPhase: number, ingressPhase: number, isAsym: boolean = false) => {
  const points = [];
  const totalPoints = 200;
  
  for (let i = 0; i < totalPoints; i++) {
    const phase = -0.25 + (i / totalPoints) * 0.5;
    let flux = 1.0 + (Math.random() - 0.5) * 0.0006;
    let model = 1.0;
    
    const absPhase = Math.abs(phase);
    const tHalf = durationPhase / 2.0;
    const tFlat = tHalf - ingressPhase;
    
    // Evaluate trapezoid model
    if (absPhase <= tFlat) {
      model = 1.0 - depth;
    } else if (absPhase <= tHalf) {
      // Linear slope during ingress/egress
      const ingressFraction = (tHalf - absPhase) / ingressPhase;
      model = 1.0 - depth * ingressFraction;
    }
    
    // Apply transit effect to flux
    flux += (model - 1.0);
    
    // If asymmetric false positive, skew the flux
    if (isAsym && phase > 0 && absPhase <= tHalf) {
      flux += 0.0015; // distort egress shape
    }
    
    points.push({
      phase: parseFloat(phase.toFixed(4)),
      flux: parseFloat(flux.toFixed(5)),
      model: parseFloat(model.toFixed(5))
    });
  }
  return points.sort((a, b) => a.phase - b.phase);
};

// 1. Mock Planet Result
export const mockPlanet: PredictionResult = {
  class_label: "Planet",
  confidence: 0.9425,
  probabilities: {
    Planet: 0.9425,
    EB: 0.0142,
    "False Positive": 0.0433
  },
  metrics: {
    bls: [
      { label: "Period", value: "4.2803 days", description: "Transit repeat interval" },
      { label: "Transit Duration", value: "0.1140 days", description: "Full transit time width" },
      { label: "BLS Depth", value: "0.00574", description: "Observed fractional dimming" },
      { label: "BLS Power", value: "2436.41", description: "Signal power spectral density" },
      { label: "Peak Sigma", value: "14.04", description: "Detection significance level" }
    ],
    transit: [
      { label: "Depth", value: "10,147.1 ppm", description: "Trapezoid model depth" },
      { label: "Transit Duration", value: "2.736 hours", description: "Fitted transit window width" },
      { label: "Ingress Duration", value: "0.731 hours", description: "Time spent entering/exiting" },
      { label: "Ingress Phase", value: "0.0144", description: "Ingress width in phase units" },
      { label: "Reduced Chi Square", value: "0.9962", description: "Goodness-of-fit statistic" }
    ],
    physics: [
      { label: "Ingress Fraction", value: "0.3852", description: "Ingress duration over total duration" },
      { label: "Flat Bottom Fraction", value: "0.2295", description: "Flat eclipse duration over total" },
      { label: "Transit SNR", value: "26.58", description: "Ratio of depth to out-of-transit noise" },
      { label: "Secondary Depth", value: "0.0 ppm", description: "No secondary eclipse detected" },
      { label: "Secondary SNR", value: "0.00", description: "Secondary detection significance" },
      { label: "Duty Cycle", value: "0.0298", description: "Orbit fraction spent in transit" },
      { label: "OOT RMS", value: "0.00193", description: "Out-of-transit noise level" },
      { label: "Transit RMS", value: "0.00206", description: "In-transit noise level" },
      { label: "Shape RMSE", value: "0.00237", description: "Transit left/right reflection residual" },
      { label: "Transit Skewness", value: "0.1146", description: "In-transit skewness profile" },
      { label: "Transit Kurtosis", value: "-0.1365", description: "In-transit flatness shape factor" }
    ]
  },
  originalCurve: generateOriginalCurve(4.2803, 0.0101, 0.1140),
  detrendedCurve: generateDetrendedCurve(4.2803, 0.0101, 0.1140),
  periodogram: generatePeriodogram(4.2803),
  foldedCurve: generateFoldedCurve(0.0101, 0.0266, 0.0102)
};

// 2. Mock Eclipsing Binary Result
export const mockEB: PredictionResult = {
  class_label: "Eclipsing Binary",
  confidence: 0.9852,
  probabilities: {
    Planet: 0.0041,
    EB: 0.9852,
    "False Positive": 0.0107
  },
  metrics: {
    bls: [
      { label: "Period", value: "0.9423 days", description: "Transit repeat interval" },
      { label: "Transit Duration", value: "0.0750 days", description: "Full transit time width" },
      { label: "BLS Depth", value: "0.00713", description: "Observed fractional dimming" },
      { label: "BLS Power", value: "928.75", description: "Signal power spectral density" },
      { label: "Peak Sigma", value: "13.02", description: "Detection significance level" }
    ],
    transit: [
      { label: "Depth", value: "7,566.25 ppm", description: "Trapezoid model depth" },
      { label: "Transit Duration", value: "3.572 hours", description: "Fitted transit window width" },
      { label: "Ingress Duration", value: "0.503 hours", description: "Time spent entering/exiting" },
      { label: "Ingress Phase", value: "0.0029", description: "Ingress width in phase units" },
      { label: "Reduced Chi Square", value: "0.9658", description: "Goodness-of-fit statistic" }
    ],
    physics: [
      { label: "Ingress Fraction", value: "0.3164", description: "Ingress duration over total duration" },
      { label: "Flat Bottom Fraction", value: "0.3671", description: "Flat eclipse duration over total" },
      { label: "Transit SNR", value: "4.38", description: "Ratio of depth to out-of-transit noise" },
      { label: "Secondary Depth", value: "584.8 ppm", description: "Deep secondary eclipse found" },
      { label: "Secondary SNR", value: "3.09", description: "Secondary detection significance" },
      { label: "Duty Cycle", value: "0.1038", description: "Orbit fraction spent in transit" },
      { label: "OOT RMS", value: "0.00576", description: "Out-of-transit noise level" },
      { label: "Transit RMS", value: "0.00645", description: "In-transit noise level" },
      { label: "Shape RMSE", value: "0.00989", description: "Transit left/right reflection residual" },
      { label: "Transit Skewness", value: "-0.1934", description: "In-transit skewness profile" },
      { label: "Transit Kurtosis", value: "0.1705", description: "In-transit flatness shape factor" }
    ]
  },
  originalCurve: generateOriginalCurve(0.9423, 0.0075, 0.0750, true),
  detrendedCurve: generateDetrendedCurve(0.9423, 0.0075, 0.0750, true),
  periodogram: generatePeriodogram(0.9423),
  foldedCurve: generateFoldedCurve(0.0075, 0.0796, 0.0252)
};

// 3. Mock False Positive (Blend) Result
export const mockFP: PredictionResult = {
  class_label: "False Positive",
  confidence: 0.8714,
  probabilities: {
    Planet: 0.0815,
    EB: 0.0471,
    "False Positive": 0.8714
  },
  metrics: {
    bls: [
      { label: "Period", value: "7.6569 days", description: "Transit repeat interval" },
      { label: "Transit Duration", value: "0.1680 days", description: "Full transit time width" },
      { label: "BLS Depth", value: "0.00170", description: "Observed fractional dimming" },
      { label: "BLS Power", value: "30.98", description: "Signal power spectral density" },
      { label: "Peak Sigma", value: "5.72", description: "Detection significance level" }
    ],
    transit: [
      { label: "Depth", value: "1,701.10 ppm", description: "Trapezoid model depth" },
      { label: "Transit Duration", value: "4.032 hours", description: "Fitted transit window width" },
      { label: "Ingress Duration", value: "1.210 hours", description: "Time spent entering/exiting" },
      { label: "Ingress Phase", value: "0.0221", description: "Ingress width in phase units" },
      { label: "Reduced Chi Square", value: "2.1450", description: "Goodness-of-fit statistic" }
    ],
    physics: [
      { label: "Ingress Fraction", value: "0.4502", description: "Ingress duration over total duration" },
      { label: "Flat Bottom Fraction", value: "0.0996", description: "Flat eclipse duration over total" },
      { label: "Transit SNR", value: "2.11", description: "Ratio of depth to out-of-transit noise" },
      { label: "Secondary Depth", value: "15.0 ppm", description: "Very shallow secondary eclipse" },
      { label: "Secondary SNR", value: "0.15", description: "Secondary detection significance" },
      { label: "Duty Cycle", value: "0.0231", description: "Orbit fraction spent in transit" },
      { label: "OOT RMS", value: "0.00812", description: "Out-of-transit noise level" },
      { label: "Transit RMS", value: "0.00882", description: "In-transit noise level" },
      { label: "Shape RMSE", value: "0.01000", description: "Transit left/right reflection residual (High Asymmetry)" },
      { label: "Transit Skewness", value: "0.0172", description: "In-transit skewness profile" },
      { label: "Transit Kurtosis", value: "1.2117", description: "In-transit flatness shape factor" }
    ]
  },
  originalCurve: generateOriginalCurve(7.6569, 0.0017, 0.1680),
  detrendedCurve: generateDetrendedCurve(7.6569, 0.0017, 0.1680),
  periodogram: generatePeriodogram(7.6569),
  foldedCurve: generateFoldedCurve(0.0017, 0.0219, 0.0099, true)
};

export const getMockPrediction = (filename: string): PredictionResult => {
  const nameLower = filename.toLowerCase();
  if (nameLower.includes("toi") || nameLower.includes("planet") || nameLower.includes("candidate")) {
    return mockPlanet;
  } else if (nameLower.includes("eb") || nameLower.includes("binary") || nameLower.includes("eclipse")) {
    return mockEB;
  } else {
    return mockFP;
  }
};
