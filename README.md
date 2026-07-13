# Exoplanet Detection System (TESS Survey Transit Pipeline)

[![Python Version](https://img.shields.io/badge/Python-3.9%20%7C%203.10%20%7C%203.11-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Data Source](https://img.shields.io/badge/Data%20Source-NASA%20TESS-orange.svg)](https://heasarc.gsfc.nasa.gov/docs/tess/tess.html)
[![Model](https://img.shields.io/badge/Classifier-XGBoost%20v2.0-indigo.svg)](https://xgboost.readthedocs.io/)

An end-to-end, scientifically calibrated exoplanet detection platform that reads raw NASA TESS (Transiting Exoplanet Survey Satellite) FITS files, preprocesses and detrends light curves, runs a Box Least Squares (BLS) transit search, fits a physical trapezoid model using Levenberg-Marquardt optimization, extracts 14 unified shape features, and runs them through a pre-trained XGBoost classifier to identify **Exoplanets (Planets)**, **Eclipsing Binaries (EBs)**, and **False Positives (FPs)**.

Includes a Flask API backend and an interactive, React-based scientific dashboard.

---

## Repository Architecture & Pipeline Stages

```mermaid
graph TD
    A[Raw TESS FITS File] --> B[FitsReader]
    B --> C[Preprocessor: Savitzky-Golay Detrending]
    C --> D[BLSDetector: 6000-step power spectrum search]
    D --> E[PhaseFolder: folding on T0 & Period]
    E --> F[TrapezoidFitter: Levenberg-Marquardt fit]
    F --> G[FeatureExtractor: 14 Physics & Shape metrics]
    G --> H[ExoplanetClassifier: XGBoost Model]
    H --> I[React Scientific Dashboard]
```

### 1. FITS Data Processing (`src/pipeline/fits_reader.py`)
Extracts time-series columns from standard TESS Light Curve files (HDU index 1 binary table):
- **Time** ($T$, `TIME` column in BJD - 2457000)
- **Flux** ($F$, `PDCSAP_FLUX` column, representing Pre-search Data Conditioning SAP flux)
- **Flux Error** ($\sigma_F$, `PDCSAP_FLUX_ERR`)
- **Quality** (`QUALITY` bitmask flags)

---

### 2. Cleaning & Savitzky-Golay Detrending (`src/pipeline/preprocessing.py`)
Astronomical light curves suffer from slow instrumental wiggles (thermal drift, pointing wiggles) and stellar activity.
- **Quality Filtering**: Discards cadences where $\text{QUALITY} \neq 0$ (bad data flags).
- **Savitzky-Golay Detrending**: Estimates the local stellar baseline $B(t)$ by fitting a local polynomial of degree $d$ over a sliding window of length $W$:
  $$y_i = \sum_{j=0}^{d} c_j i^j$$
  We employ $W=1001$ cadences and $d=2$.
- **Relative Residuals**: Produces `Normalized_Flux` ($F_{\text{norm}}$) and relative residuals `Detrended_Flux` ($F_{\text{det}}$) centered around $0.0$ for least-squares optimization:
  $$F_{\text{norm}}(t) = \frac{F(t)}{B(t)}, \quad F_{\text{det}}(t) = \frac{F(t) - B(t)}{B(t)}$$

---

### 3. Box Least Squares (BLS) Transit Search (`src/pipeline/bls_detector.py`)
Scans the detrended light curve sector-by-sector for periodic, box-like transit dips.
- **Search Grid**: Searches a linear grid of **6,000 trial periods** between 0.5 and 15.0 days, and **50 trial durations** (approx. 1 to 12 hours).
- **BLS Power Metric**: Computes the chi-squared difference between a flat line model and a periodic step-function transit model:
  $$\text{Power}(P) = \Delta \chi^2(P) = \chi^2_{\text{flat}} - \chi^2_{\text{transit}}(P) = \frac{\left( \sum w_i (y_i - 1) \right)^2}{\sum w_i}$$
  where the weights are $w_i = \frac{1}{\sigma_{F, \text{norm}, i}^2}$ (inverse-variance weighting).
- **Candidacy Selection**: Picks the sector showing the strongest periodic signal based on maximum BLS power.

---

### 4. Phase Folding & Trapezoid Transit Fitting (`src/pipeline/trapezoid_fit.py`, `src/pipeline/phase_folding.py`)
- **Phase Folding**: Folds the light curve around the detected period ($P$) and epoch ($T_0$), centering the phase domain in $[-0.5, 0.5]$:
  $$\phi(t) = \left( \frac{t - T_0 + 0.5 P \pmod P}{P} \right) - 0.5$$
- **Trapezoidal Model Fitting**: Fits a physical trapezoid model to the folded data inside a window cropped to 3 times the transit width using Levenberg-Marquardt least-squares optimization. The model is parameterized by:
  - **Depth** ($\delta$): Fractional transit depth.
  - **Total Duration** ($T_{\text{tot}}$): Total transit width (first to fourth contact, in phase units).
  - **Ingress Duration** ($T_{\text{in}}$): Ingress/egress width (first to second contact, in phase units).

---

### 5. Unified Feature Engineering (`src/pipeline/feature_extractor.py`)
Extracts **14 physical and statistical parameters** representing transit symmetry, depths, and moments:
- `transit_duration_hours` ($T_{\text{tot}}$ in hours)
- `ingress_duration_hours` ($T_{\text{in}}$ in hours)
- `depth_ppm` ($\delta \cdot 10^6$)
- `red_chi2` (goodness-of-fit) & `rms_resid`
- `ingress_fraction`: Ratio of ingress time to total duration:
  $$f_{\text{ingress}} = \frac{T_{\text{in}}}{T_{\text{tot}}}$$
- `flat_bottom_fraction`: Flat eclipsing duration over total duration (differentiates V-shaped grazing binaries from U-shaped exoplanets):
  $$f_{\text{flat}} = 1 - 2 \cdot f_{\text{ingress}}$$
- `transit_snr`: Ratio of depth to out-of-transit noise.
- `secondary_depth` & `secondary_snr`: Scans for secondary eclipses (identifies Eclipsing Binaries).
- `shape_rmse`: Left/right reflection RMS difference (quantifies asymmetry).
- `odd_even_ratio`: Compares odd and even transits (flags grazing binaries with alternating depths).
- `transit_skewness` & `transit_kurtosis`: In-transit shape moments.

---

### 6. Machine Learning Classification (`src/pipeline/classifier.py`)
Loads a frozen pre-trained XGBoost model (`src/models/final_xgboost.pkl`). Aligns features to the model's expected training vector:
- `0 -> Planet`
- `1 -> EB` (Eclipsing Binary)
- `2 -> False Positive`

---

## 7. Interactive API Server & Scientific UI

- **Flask Backend (`src/api.py`)**: Runs pipeline queries on upload, downsamples time series coordinates to exactly 500 points using a **peak-preserving index lock** to preserve narrow periodogram spikes.
- **Scientific Dashboard (`frontend/`)**: Renders:
  - **Target Metadata Banner**: Displaying TIC ID, sectors, best sector, AI prediction, and probability distributions.
  - **BLS Search Parameter Panel**: Dynamically retrieved search ranges, grid sizes, and weighting.
  - **Full-Width Spacious Plots**: Raw curve with red baseline overlay, detrended residuals with trapezoid model overlay, BLS periodogram with reference dashed lines and dot markers, and phase-folded overlay.
  - **Fullscreen Immersive Modal**: Allows expanding any chart for detailed inspection and PNG exports.

---

## How to Run Locally

### Prerequisites
- Python 3.9+
- Node.js 18+

### Setup & Run (Single Launcher Command)
1. Clone the repository and navigate to the project directory.
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Install Node launcher dependencies:
   ```bash
   npm install
   ```
4. Start both the Python API backend and React dev frontend concurrently:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to:
   **[http://localhost:5173](http://localhost:5173)** (or the port specified in the terminal).
