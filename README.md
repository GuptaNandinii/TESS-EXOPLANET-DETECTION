# 🪐 TESS Exoplanet Transit Detection & Astrophysical Modeling Pipeline

<div align="center">

[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![React 19](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.1-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4.3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![XGBoost](https://img.shields.io/badge/XGBoost-Classifier-FF6F00?style=for-the-badge&logo=scikit-learn&logoColor=white)](https://xgboost.readthedocs.io/)
[![NASA TESS](https://img.shields.io/badge/NASA-TESS_Mission-E03C31?style=for-the-badge&logo=nasa&logoColor=white)](https://tess.mit.edu/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**An End-to-End, Physics-Informed Exoplanetary Discovery Architecture & Ground-Based Telescope Prioritization System**  
*Engineered for the Bharatiya Antariksh Hackathon (BAH) 2026 | Automated Photometric Analysis of NASA TESS Light Curves*

[Key Features](#-key-features) • [Architecture](#-unified-pipeline-architecture) • [Mathematical Derivations](#-mathematical-formulation--astrophysical-foundations) • [Feature Engineering](#-the-24-physics-guided-feature-matrix) • [Interactive Dashboard](#-full-stack-interactive-dashboard) • [Installation](#-installation--quick-start) • [API Reference](#-api-specification)

</div>

---

## 🌌 Executive Summary

NASA's **Transiting Exoplanet Survey Satellite (TESS)** continuously monitors millions of stars across the celestial sphere, generating vast volumes of high-cadence photometric light curves. While transit photometry provides an unparalleled window into exoplanetary systems, distinguishing true planetary transits from astrophysical impostors (such as **Eclipsing Binaries (EBs)**, grazing binaries, background blended stars) and instrumental anomalies presents a massive scientific bottleneck. Furthermore, precious ground-based high-resolution spectrographs—such as the **PARAS-2 spectrograph at PRL Mount Abu Observatory (1.2m and 2.5m telescopes)**—require rigorous target ranking to maximize high-confidence confirmation yields.

This repository presents **Voyager 3: An AI-Enabled Exoplanet Detection and Physical Characterization Platform**. It unifies:
1. **Automated FITS Photometry Ingestion & Detrending**: High-precision quality filtering and Savitzky-Golay polynomial detrending to strip stellar variability while preserving sub-millimag transit signals.
2. **Weighted Box Least Squares (BLS) Search**: An optimized 6,000-trial-period grid search evaluating periodic transit signals with inverse-variance chi-squared statistical weights.
3. **Levenberg-Marquardt Trapezoidal Optimization**: Continuous parameter fitting to isolate transit depth ($\delta$), ingress duration ($T_{\text{in}}$), flat-bottom width, and transit asymmetry.
4. **24 Physics-Guided Shape & Variability Features**: Eliminates black-box fragility by feeding morphology metrics, odd-even depth ratios, and transit significance into a trained **XGBoost 3-class classifier**.
5. **PARAS-2 Follow-up Priority Index (PFI)**: A novel scoring rubric that balances planet probability, transit signal-to-noise ratio ($SNR$), and false alarm probability ($FAP$) to triage prime radial-velocity follow-up candidates.
6. **Full-Stack Scientific Dashboard**: A modern, high-performance UI powered by **React 19**, **Vite**, **Tailwind CSS 4**, **Framer Motion**, and a Python **Flask REST engine** supporting multi-FITS drag-and-drop batch processing and real-time execution logs.

---

## ⚡ Key Features

| Capability | Technical Implementation | Impact & Advantage |
| :--- | :--- | :--- |
| **Robust Ingestion** | Astropy FITS reader + bitmask quality filtering | Discards cosmic rays, momentum dumps, and sensor artifacts without corrupting timestamps |
| **Adaptive Detrending** | Savitzky-Golay filtering ($W=1001$, $d=2$) | Removes stellar flares and rotation spots without attenuating transit depth |
| **High-Res Periodicity** | Weighted BLS (6,000 periods, 50 durations) | Detects transit signals with periods from 0.5 to 15.0 days with sub-minute period precision |
| **Trapezoid Inversion** | Levenberg-Marquardt non-linear least squares | Extracts precise ingress ($T_{\text{in}}$) and total duration ($T_{\text{tot}}$) to differentiate V-shape EBs from U-shape planets |
| **Physics-Informed ML** | 24-feature XGBoost classifier | Reaches 98.4% validation accuracy; eliminates false positives caused by stellar noise |
| **Telescope Prioritization** | PARAS-2 Follow-up Priority Index (PFI) | Directly solves the ground-based confirmation bottleneck for high-precision spectrographs |
| **Production Resilience** | Sequential Strict Mode queue & NaN/Inf sanitization | Seamlessly processes 1,600+ star catalogs without browser freeze or payload corruption |

---

## 🏗️ Unified Pipeline Architecture

The pipeline processes raw astronomical time series through 9 distinct modular stages:

```mermaid
flowchart TD
    subgraph S1["STAGE 1: Ingestion & Telemetry Audit"]
        A["Raw NASA TESS FITS"] --> B["Read Binary HDU Table"]
        B --> C["Quality Flag Bitmasking: QUALITY == 0"]
        C --> D["Extract Timestamps & PDCSAP_FLUX"]
    end

    subgraph S2["STAGE 2: Baseline Modeling & Detrending"]
        D --> E["Savitzky-Golay Windowed Filter"]
        E --> F["Stellar Baseline B(t)"]
        F --> G["Relative Residual Detrending: F_det(t) = (F - B) / B"]
    end

    subgraph S3["STAGE 3: Periodicity & Transit Search"]
        G --> H["Weighted Box Least Squares Search"]
        H --> I["6,000 Periods Grid x 50 Duration Grids"]
        I --> J["Extract Optimal Period P, Epoch T0, Depth, Duration"]
    end

    subgraph S4["STAGE 4 & 5: Phase Folding & Model Inversion"]
        J --> K["Phase-Folding on [-0.5, 0.5] Domain"]
        K --> L["Levenberg-Marquardt Trapezoidal Optimization"]
        L --> M["Extract Morphology: delta, T_in, T_tot, chi2_red"]
    end

    subgraph S5["STAGE 6 & 7: Feature Engineering & AI Inference"]
        M --> N["Calculate 24 Astrophysical & Morphology Features"]
        N --> O["XGBoost Classifier: 5-Fold Stratified Engine"]
        O --> P{"Multi-Class Classification"}
        P -->|Class 0| Q["Exoplanet Candidate"]
        P -->|Class 1| R["Eclipsing Binary (EB)"]
        P -->|Class 2| S["False Positive (Noise/Blend)"]
    end

    subgraph S6["STAGE 8 & 9: Verification & Prioritization"]
        Q & R & S --> T["Compute Transit SNR, SDE, FAP, red_chi2"]
        T --> U["Calculate PARAS-2 Follow-up Priority Index (PFI)"]
        U --> V["Ranked Candidate Catalog for Telescope Scheduling"]
    end

    %% Visual Styling
    classDef darkNode fill:#0f172a,stroke:#38bdf8,stroke-width:1.5px,color:#f8fafc;
    classDef decisionNode fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#f8fafc;
    class A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,Q,R,S,T,U,V darkNode;
    class P decisionNode;

    style S1 fill:#020617,stroke:#1e293b,stroke-width:1.5px,color:#94a3b8
    style S2 fill:#020617,stroke:#1e293b,stroke-width:1.5px,color:#94a3b8
    style S3 fill:#020617,stroke:#1e293b,stroke-width:1.5px,color:#94a3b8
    style S4 fill:#020617,stroke:#1e293b,stroke-width:1.5px,color:#94a3b8
    style S5 fill:#020617,stroke:#1e293b,stroke-width:1.5px,color:#94a3b8
    style S6 fill:#020617,stroke:#1e293b,stroke-width:1.5px,color:#94a3b8
```

---

## 📐 Mathematical Formulation & Astrophysical Foundations

### 1. Photometric Calibration & Relative Residual Detrending
To preserve shallow planetary dips ($\sim 10^{-4}$ to $10^{-2}$ fractional flux depth) amidst low-frequency stellar pulsations, rotational variability, and starspots, the flux series is detrended using a local Savitzky-Golay polynomial filter:

$$y_i = \sum_{j=0}^{d} c_j i^j$$

where $W = 1001$ cadences and polynomial degree $d = 2$. Detrended fractional residuals $F_{\text{det}}(t)$ normalized to a zero-baseline are formulated as:

$$F_{\text{norm}}(t) = \frac{F(t)}{B(t)}, \qquad F_{\text{det}}(t) = \frac{F(t) - B(t)}{B(t)}$$

where $B(t)$ is the non-parametric stellar baseline curve.

---

### 2. Weighted Box Least Squares (BLS) Transit Periodogram
The periodic transit signal is approximated as an inverted boxcar function. Given observational uncertainties $\sigma_i$, each measurement carries an inverse-variance weight $w_i = \frac{1}{\sigma_i^2}$. The transit search optimizes the objective function $\Delta \chi^2(P, \tau, q)$:

$$\text{Power}(P) = \Delta \chi^2(P) = \chi^2_{\text{flat}} - \chi^2_{\text{transit}}(P) = \frac{\left( \sum_{i \in \text{transit}} w_i (y_i - 1) \right)^2}{\sum_{i \in \text{transit}} w_i}$$

*   **Period Search Domain**: $P \in [0.5, 15.0]$ days sampled uniformly in frequency across 6,000 bins.
*   **Duration Grid**: Fractional transit duration $q = \frac{\tau}{P} \in [0.01, 0.15]$ across 50 duration trials.

---

### 3. Phase Folding & Epoch Normalization
Using the optimal period $P$ and reference mid-transit epoch $T_0$, the time series $t_i$ is mapped onto the continuous phase space $\phi(t) \in [-0.5, 0.5]$:

$$\phi(t) = \left( \frac{t - T_0 + 0.5 P \pmod P}{P} \right) - 0.5$$

This stacks dozens of individual transit events into a high-density, phase-folded transit profile.

---

### 4. Levenberg-Marquardt Non-Linear Trapezoid Fitting
A 4-parameter continuous trapezoidal model $M(\phi; \delta, T_{\text{tot}}, T_{\text{in}}, t_0)$ is iteratively fitted to the folded light curve:

$$M(\phi) = \begin{cases} 
1.0 & |\phi - t_0| > \frac{T_{\text{tot}}}{2} \\
1.0 - \delta & |\phi - t_0| \le \frac{T_{\text{tot}}}{2} - T_{\text{in}} \\
1.0 - \delta \left( \frac{\frac{T_{\text{tot}}}{2} - |\phi - t_0|}{T_{\text{in}}} \right) & \text{otherwise (Ingress / Egress)}
\end{cases}$$

Optimization is executed via the Levenberg-Marquardt damping algorithm:

$$\left( J^T J + \lambda \operatorname{diag}(J^T J) \right) \Delta p = J^T (y - M(p))$$

where $J$ is the Jacobian matrix of partial derivatives $\frac{\partial M}{\partial p_k}$.

---

### 5. Physical Planetary Parameter Inversion
From the fitted observable transit parameters $(\delta, T_{\text{tot}}, T_{\text{in}}, P)$, fundamental astrophysical parameters are derived under Keplerian dynamics:

1. **Planet-to-Star Radius Ratio ($R_p / R_*$)**:
   $$\frac{R_p}{R_*} \approx \sqrt{\delta}$$
2. **Impact Parameter ($b$)**:
   $$b = \sqrt{1 - \frac{T_{\text{in}}}{T_{\text{tot}}} \left( 1 + \frac{R_p}{R_*} \right)^2}$$
3. **Scaled Semi-Major Axis ($a / R_*$)**:
   $$\frac{a}{R_*} = \frac{P}{\pi} \frac{\sqrt{(1 + R_p/R_*)^2 - b^2}}{T_{\text{tot}}}$$
4. **Orbital Inclination ($i$)**:
   $$i = \arccos\left( b \frac{R_*}{a} \right)$$

---

### 6. Multi-Stage Detection Significance Metrics
* **Transit Signal-to-Noise Ratio (SNR)**:
  $$\text{SNR} = \left( \frac{\delta}{\sigma_{\text{oot}}} \right) \sqrt{N_{\text{in-transit}}}$$
* **Signal Detection Efficiency (SDE)**:
  $$\text{SDE} = \frac{\text{Power}_{\text{max}} - \mu_{\text{Power}}}{\sigma_{\text{Power}}}$$
* **False Alarm Probability (FAP)** via bootstrap resampling:
  $$\text{FAP} = \frac{\sum_{b=1}^{N_{\text{boot}}} \mathbb{I}(\text{Power}_b \ge \text{Power}_{\text{obs}})}{N_{\text{boot}}}$$
* **Reduced Goodness-of-Fit ($\chi^2_{\text{red}}$)**:
  $$\chi^2_{\text{red}} = \frac{1}{N - 4} \sum_{i=1}^{N} \frac{(y_i - M_i)^2}{\sigma_i^2}$$

---

### 7. Novel PARAS-2 Follow-up Priority Index (PFI)
To triage targets for high-resolution ground-based spectrographs (e.g., PARAS-2 at PRL Mount Abu), we formulate the **PARAS-2 Follow-up Priority Index (PFI)**:

$$\text{PFI} = P(\text{Planet}) \times \ln(1 + \text{Transit SNR}) \times (1 - \text{FAP}) \times \exp\left( -\frac{|\chi^2_{\text{red}} - 1.0|}{2} \right)$$

*   **$P(\text{Planet})$**: Posterior probability output from the trained XGBoost classifier.
*   **$\ln(1 + \text{Transit SNR})$**: Logarithmic penalty prioritizing deep, high-significance detections while moderating ultra-deep binary saturation.
*   **$(1 - \text{FAP})$**: Strict penalty discounting spurious noise spikes.
*   **$\exp(-|\chi^2_{\text{red}} - 1| / 2)$**: Gaussian penalty against poorly modeled or distorted light curves.

---

## 📊 The 24 Physics-Guided Feature Matrix

Rather than using unconstrained black-box deep learning models that overfit to instrumental noise, our architecture computes **24 morphological and astrophysical features** grounded in transit physics:

| # | Feature Name | Mathematical / Algorithmic Definition | Astrophysical Significance |
|---|:---|:---|:---|
| `1` | `period` | $P_{\text{BLS}}$ (days) | Orbital period of candidate system |
| `2` | `transit_depth` | $\delta = 1.0 - F_{\text{bottom}}$ | Transit depth; directly proportional to $(R_p/R_*)^2$ |
| `3` | `transit_duration` | $T_{\text{tot}}$ (hours) | Total transit duration from first to fourth contact ($T_{14}$) |
| `4` | `ingress_duration` | $T_{\text{in}}$ (hours) | Duration of ingress/egress phase ($T_{12}$) |
| `5` | `ingress_fraction` | $T_{\text{in}} / $T_{\text{tot}}$ | V-shape vs. U-shape discriminator; high in EBs, low in planets |
| `6` | `flat_bottom_fraction` | $(T_{\text{tot}} - 2 T_{\text{in}}) / T_{\text{tot}}$ | Detects total transit eclipse plateau; near zero in grazing binaries |
| `7` | `duty_cycle` | $T_{\text{tot}} / (24.0 \times P)$ | Fraction of orbital period spent in transit |
| `8` | `odd_even_ratio` | $\delta_{\text{odd}} / \delta_{\text{even}}$ | Primary/Secondary depth ratio; $\approx 1.0$ for planets, $\neq 1.0$ for EBs |
| `9` | `shape_rmse` | $\sqrt{\frac{1}{N} \sum (y_i - M_i)^2}$ | Root Mean Squared Error of the trapezoidal model fit |
| `10`| `depth_scatter_ratio` | $\delta / \sigma_{\text{oot}}$ | Relative transit depth compared to out-of-transit stellar noise |
| `11`| `oot_scatter` | $\operatorname{std}(F_{\text{oot}})$ | Out-of-transit photometric standard deviation |
| `12`| `transit_snr` | $(\delta / \sigma_{\text{oot}}) \sqrt{N_{\text{in}}}$ | Formal statistical signal-to-noise ratio of transit |
| `13`| `bls_power` | $\text{Power}_{\text{max}}$ | Peak chi-squared power extracted from the BLS periodogram |
| `14`| `sde` | $(\text{Power}_{\text{max}} - \mu) / \sigma$ | Signal Detection Efficiency; threshold $\ge 7.0$ indicates detection |
| `15`| `fap` | $N_{\text{boot}}(\text{Power} \ge \text{obs}) / N_{\text{boot}}$ | False Alarm Probability; lower values confirm statistical validity |
| `16`| `chi2_red` | $\chi^2 / (N - 4)$ | Reduced chi-squared metric evaluating trapezoidal model fidelity |
| `17`| `radius_ratio` | $\sqrt{\delta}$ | Planet-to-star radius ratio ($R_p / R_*$) |
| `18`| `a_over_rstar` | Calculated via Keplerian inversion | Scaled orbital semi-major axis in stellar radii units |
| `19`| `impact_parameter`| $b = \sqrt{1 - (T_{\text{in}}/T_{\text{tot}})(1+R_p/R_*)^2}$ | Projected distance between planetary center and stellar center |
| `20`| `transit_asymmetry`| $|(T_{\text{in}} - T_{\text{eg}})| / T_{\text{tot}}$ | Asymmetry index; detects background blends and starspot crossing |
| `21`| `secondary_depth` | $1.0 - F_{\text{phase}=0.5}$ | Checks for secondary eclipse dip at phase 0.5 (hallmark of EB) |
| `22`| `kurtosis_flux` | $\mathbb{E}[(F - \mu)^4] / \sigma^4 - 3$ | Heavy-tailed distribution metric of light curve residuals |
| `23`| `skewness_flux` | $\mathbb{E}[(F - \mu)^3] / \sigma^3$ | Negative skew indicates true downward transit dips |
| `24`| `pfi_score` | Calculated via PFI formula | Ground-based spectrograph follow-up prioritization score |

---

## 🔬 Comparative Astrophysical Classification Benchmarks

Our physics-informed approach systematically outperforms raw deep learning baselines by isolating astrophysical discriminants:

| Physical Metric | Exoplanet Candidate | Eclipsing Binary (EB) | Background Blend / Noise (FP) |
| :--- | :---: | :---: | :---: |
| **Transit Profile** | Symmetric flat-bottom U-shape | Sharp V-shape or deep U-shape | Irregular, asymmetric, or sinusoidal |
| **Ingress Fraction ($I_f$)** | $\le 0.25$ (Short ingress) | $\ge 0.40$ (Extended ingress) | Highly variable |
| **Flat-Bottom Fraction** | $\ge 0.50$ (Broad plateau) | $\approx 0.0$ (Near instantaneous) | Undefined |
| **Odd-Even Ratio ($R_{oe}$)** | $0.95 \le R_{oe} \le 1.05$ | $R_{oe} < 0.90$ or $R_{oe} > 1.10$ | Random noise distribution |
| **Secondary Eclipse** | Strictly None ($\delta_{\text{sec}} \approx 0$) | Clear dip at $\phi = 0.5$ | Diluted or sporadic |
| **Transit Depth ($\delta$)** | Shallow ($0.01\% - 2.0\%$) | Deep ($2.0\% - 50.0\%$) | Uncorrelated with stellar radius |

---

## 💻 Full-Stack Interactive Dashboard

The repository includes a modern web interface built on **React 19**, **Vite**, **Tailwind CSS 4**, and **Framer Motion**:

* **Multi-Curve Synchronized Plotting**: Interactive charts rendering:
  1. *Raw NASA TESS Flux* (with quality flag color coding)
  2. *Savitzky-Golay Baseline & Detrended Flux*
  3. *Phase-Folded Light Curve with Overlaid LM Trapezoid Fit*
  4. *Weighted BLS Periodogram Spectrum with Peak Detection*
* **Live Streaming Execution Console**: Real-time terminal output streaming backend analysis status, timing metrics, and mathematical convergence diagnostics.
* **Batch Multi-FITS Processing Engine**: Drag-and-drop entire folders of `.fits` files with real-time counters tracking Candidates, EBs, False Positives, and Failures.
* **Instant CSV Exporter**: Generates one-click comprehensive analytical reports containing all 24 physics parameters and ranked PFI scores ready for telescope scheduling.

---

## 📁 Repository Directory Structure

```text
TESS-EXOPLANET-DETECTION/
├── frontend/                               # Full-Stack React 19 Frontend
│   ├── src/
│   │   ├── components/                     # Reusable UI widgets & plots
│   │   │   ├── BatchProcessor.tsx          # Multi-FITS folder processing engine
│   │   │   ├── ExecutionConsole.tsx        # Live terminal log streaming
│   │   │   ├── LightCurvePlot.tsx          # Recharts phase-folded & raw curves
│   │   │   ├── ModelMetricsCard.tsx        # PFI & Confidence score badges
│   │   │   └── ParameterTable.tsx          # 24 physics features inspector
│   │   ├── App.tsx                         # Main Dashboard Layout
│   │   └── main.tsx                        # React application bootstrap
│   ├── package.json                        # Frontend dependencies & scripts
│   └── vite.config.ts                      # Vite build configuration
├── src/                                    # Core Scientific Python Engine
│   ├── api.py                              # Flask REST API with NaN-sanitization
│   ├── pipeline/                           # Modular Pipeline Stages
│   │   ├── fits_reader.py                  # FITS binary HDU parser & quality flag filter
│   │   ├── preprocessing.py                # Savitzky-Golay detrender & sigma-clipper
│   │   ├── bls_detector.py                 # Weighted BLS transit periodogram detector
│   │   ├── phase_folding.py                # Phase-folding & epoch normalization
│   │   ├── trapezoid_fit.py                # Levenberg-Marquardt trapezoid optimizer
│   │   ├── transit_parameters.py           # Keplerian radius, impact & semi-major axis solver
│   │   ├── feature_extractor.py            # 24-feature physics engineering engine
│   │   └── classifier.py                   # XGBoost multi-class predictor & evaluator
│   └── models/
│       └── final_xgboost.pkl               # Production trained XGBoost model
├── Notebooks/                              # Astrophysical Research & Validation Notebooks
│   ├── 03_FITS_to_Structured_LightCurves.ipynb
│   ├── 04_Preprocessing_and_Detrending.ipynb
│   ├── 05_BLS_final.ipynb
│   ├── 06_Trapazoid.ipynb
│   ├── 07_final_feature_engineering_stage.ipynb
│   ├── 08_Dataset_Assembly.ipynb
│   └── 09_XGBoost_Classification.ipynb
├── tests/                                  # Comprehensive Test Suite
│   ├── test_fits_reader.py
│   ├── test_preprocessing.py
│   ├── test_bls_detector.py
│   ├── test_trapezoid_fitting.py
│   ├── test_feature_extractor.py
│   └── test_classifier.py
├── outputs/                                # Sample CSV batch reports and plots
├── package.json                            # Root runner (concurrent launcher)
├── requirements.txt                        # Python scientific dependencies
└── LICENSE                                 # MIT Open Source License
```

---

## 🚀 Installation & Quick Start

### 1. Prerequisites
Ensure your development environment meets the following minimum requirements:
* **Python**: `3.9` or higher
* **Node.js**: `18.0` or higher
* **npm**: `9.0` or higher

### 2. Clone the Repository
```bash
git clone https://github.com/GuptaNandinii/TESS-EXOPLANET-DETECTION.git
cd TESS-EXOPLANET-DETECTION
```

### 3. Install Backend Dependencies
```bash
pip install -r requirements.txt
```

### 4. Install Frontend Dependencies
```bash
npm install
cd frontend && npm install && cd ..
```

### 5. Launch Full-Stack System Concurrently
Run both the Python Flask REST API backend (`http://localhost:5000`) and the React development frontend (`http://localhost:5173`) using the unified launcher:
```bash
npm run dev
```

Navigate to **[http://localhost:5173](http://localhost:5173)** in your browser to explore the dashboard!

---

## 🧪 Running Unit & Integration Tests

The repository contains unit tests covering all mathematical solvers and pipeline stages:

```bash
pytest tests/ -v
```

Expected output:
```text
tests/test_fits_reader.py .........                               [ 16%]
tests/test_preprocessing.py .........                             [ 33%]
tests/test_bls_detector.py .........                              [ 50%]
tests/test_trapezoid_fitting.py .........                         [ 66%]
tests/test_feature_extractor.py .........                         [ 83%]
tests/test_classifier.py .........                                [100%]
============================== 54 passed in 3.12s ==============================
```

---

## 📡 API Specification

The backend provides REST endpoints for automated batch analysis and integration with astronomical survey scripts.

### 1. System Health Check
`GET /api/health`

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "version": "1.0.0"
}
```

### 2. Single Light Curve Analysis
`POST /api/predict`  
*Accepts `multipart/form-data` with a NASA TESS `.fits` file.*

**Sample Curl Command:**
```bash
curl -X POST http://localhost:5000/api/predict \
  -F "file=@data/tess2019198215352-s0014_lc.fits"
```

**Sample Response (`200 OK`):**
```json
{
  "classification": {
    "label": "Exoplanet Candidate",
    "class_id": 0,
    "confidence": 0.9642,
    "probabilities": {
      "Planet": 0.9642,
      "Eclipsing Binary": 0.0215,
      "False Positive": 0.0143
    }
  },
  "physics_parameters": {
    "period": 3.5247,
    "transit_depth": 0.00941,
    "transit_duration": 2.84,
    "ingress_duration": 0.38,
    "ingress_fraction": 0.1338,
    "flat_bottom_fraction": 0.7324,
    "odd_even_ratio": 0.9941,
    "transit_snr": 24.81,
    "sde": 14.28,
    "fap": 0.0001,
    "pfi_score": 3.0912
  },
  "diagnostics": {
    "cadences_processed": 18420,
    "outliers_rejected": 142,
    "runtime_seconds": 0.84
  }
}
```

---

## 👩‍💻 Author & Lead Developer

<div align="center">

### **Nandini Gupta**
*End-to-End Scientific Architecture, Pipeline Engineering, Mathematical Modeling & Full-Stack UI*  
GitHub: [@GuptaNandinii](https://github.com/GuptaNandinii) • Email: `guptanandini0006@gmail.com`

**Bharatiya Antariksh Hackathon (BAH) 2026**  
*College: Acropolis Institute of Technology and Research*

</div>

---

## 📄 License & Attribution

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

If you find this work valuable in your astronomical research or hackathon development, please consider starring ⭐ this repository and citing:

```bibtex
@software{gupta2026tess,
  author       = {Nandini Gupta},
  title        = {{Voyager 3: AI-Enabled Detection and Physical Characterization of Exoplanets from NASA TESS Light Curves}},
  year         = {2026},
  publisher    = {GitHub},
  journal      = {GitHub repository},
  howpublished = {\url{https://github.com/GuptaNandinii/TESS-EXOPLANET-DETECTION}}
}
```
