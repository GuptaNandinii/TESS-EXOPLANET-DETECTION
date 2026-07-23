import os
import tempfile
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from astropy.timeseries import BoxLeastSquares

from src.pipeline.fits_reader import read_tess_fits
from src.pipeline.preprocessing import Preprocessor
from src.pipeline.bls_detector import BLSDetector
from src.pipeline.trapezoid_fit import fit_trapezoid_pipeline
from src.pipeline.feature_extractor import FeatureExtractor
from src.pipeline.classifier import ExoplanetClassifier

app = Flask(__name__)
CORS(app)

# Load classifier model once at start
classifier = ExoplanetClassifier()
try:
    classifier.load_model()
    print("XGBoost classifier loaded successfully into memory.")
except Exception as e:
    print(f"Warning: Failed to load classifier model: {str(e)}")

import math

def sanitize_json_value(val):
    if isinstance(val, dict):
        return {k: sanitize_json_value(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [sanitize_json_value(v) for v in val]
    elif isinstance(val, float):
        if math.isnan(val) or math.isinf(val):
            return None
    return val

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"})

@app.route('/api/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    # Save FITS upload to temporary directory (flatten path to handle folder uploads)
    temp_dir = tempfile.gettempdir()
    filename = os.path.basename(file.filename)
    temp_path = os.path.join(temp_dir, filename)
    file.save(temp_path)
    
    try:
        # 1. Read TESS FITS file
        df_raw = read_tess_fits(temp_path, filename=filename)
        
        # 2. Preprocess & Detrend
        preprocessor = Preprocessor()
        df_preprocessed = preprocessor.preprocess(df_raw)
        
        if len(df_preprocessed) == 0:
            return jsonify({"error": "No valid observations remaining after preprocessing steps"}), 400
            
        # 3. Weighted BLS candidate search
        bls_detector = BLSDetector()
        bls_res = bls_detector.detect(df_preprocessed)
        
        if bls_res is None:
            return jsonify({"error": "No periodic transit signals detected above minimum thresholds"}), 400
            
        # 4. Phase Folding & Trapezoid Transit Fitting
        fit_output = fit_trapezoid_pipeline(
            df_preprocessed,
            bls_res.detected_period,
            bls_res.detected_epoch,
            bls_res.detected_duration,
            bls_res.best_sector
        )
        
        # 5. Unified Physics & Shape Feature Extraction
        extractor = FeatureExtractor()
        features = extractor.extract_all_features(
            df_preprocessed,
            bls_res.detected_period,
            bls_res.detected_epoch,
            bls_res.detected_duration,
            fit_output.parameters["T_tot_hours"],
            fit_output.parameters["T_in_hours"]
        )
        
        # 6. Machine Learning XGBoost Classifier Evaluation
        full_features = {
            'period_days': bls_res.detected_period,
            'duration_days': bls_res.detected_duration,
            'bls_depth': bls_res.bls_depth,
            'bls_power': bls_res.bls_power,
            'peak_sigma': bls_res.peak_significance,
            'depth_ppm': fit_output.parameters["depth_ppm"],
            'T_tot_hours': fit_output.parameters["T_tot_hours"],
            'T_in_hours': fit_output.parameters["T_in_hours"],
            'ingress_phase': fit_output.parameters["ingress_phase"],
            'red_chi2': fit_output.parameters["red_chi2"],
            **features
        }
        prediction = classifier.predict_class(full_features)
        
        # Log pipeline outputs to terminal
        print("\n" + "="*50)
        print(f"PIPELINE EVALUATION - STAR TIC {bls_res.tic_id}")
        print("="*50)
        print(f"BLS parameters: period={bls_res.detected_period:.5f} d, epoch={bls_res.detected_epoch:.5f} d, power={bls_res.bls_power:.2f}")
        print(f"Trapezoid parameters: depth={fit_output.parameters['depth_ppm']:.1f} ppm, T_tot={fit_output.parameters['T_tot_hours']:.3f} h, T_in={fit_output.parameters['T_in_hours']:.3f} h, red_chi2={fit_output.parameters['red_chi2']:.4f}")
        print(f"Classifier prediction: {prediction['class_label']} (confidence: {prediction['confidence']:.4f})")
        print(f"Probabilities: Planet={prediction['probabilities']['Planet']:.4f}, EB={prediction['probabilities']['EB']:.4f}, FP={prediction['probabilities']['False Positive']:.4f}")
        print("="*50 + "\n")
        
        # 7. Prepare Downsampled plotting coordinates
        # Raw Light Curve & Baseline Trend
        df_orig = df_preprocessed.copy()
        if len(df_orig) > 500:
            df_orig = df_orig.iloc[::(len(df_orig) // 500)]
        orig_points = [
            {"time": float(t), "flux": float(f), "baseline": float(b)}
            for t, f, b in zip(df_orig["Time"], df_orig["Flux"], df_orig["Baseline"])
            if not (np.isnan(t) or np.isnan(f) or np.isnan(b))
        ]
        
        # Detrended Light Curve (relative residuals centered at 0.0)
        df_det = df_preprocessed.copy()
        if len(df_det) > 500:
            df_det = df_det.iloc[::(len(df_det) // 500)]
            
        t_depth = fit_output.parameters["depth_ppm"] / 1e6
        t_duration = fit_output.parameters["T_tot_hours"] / (bls_res.detected_period * 24.0)
        t_ingress = fit_output.parameters["ingress_phase"]
        
        from src.pipeline.phase_folding import PhaseFolder
        from src.pipeline.trapezoid_fit import TrapezoidFitter
        phase_folder = PhaseFolder()
        fitter = TrapezoidFitter()
        
        phases_full = phase_folder.phase_fold(
            df_det["Time"].values, 
            bls_res.detected_period, 
            bls_res.detected_epoch
        )
        model_full = fitter.trapezoid_model(phases_full, t_depth, t_duration, t_ingress)
        det_model_full = model_full - 1.0
        
        det_points = [
            {"time": float(t), "flux": float(f), "model": float(m)}
            for t, f, m in zip(df_det["Time"], df_det["Detrended_Flux"], det_model_full)
            if not (np.isnan(t) or np.isnan(f))
        ]
        
        # Extract the original BLS grids
        orig_periods = bls_res.periods
        orig_powers = bls_res.powers
        
        # Safe downsampling: keep every N-th point (e.g. 6000 // 500 = 12)
        # to result in exactly ~500 points for the visualization
        ds_step = len(orig_periods) // 500
        ds_indices = list(range(0, len(orig_periods), ds_step))
        
        # Lock peak index explicitly to prevent peak degradation/missing
        peak_idx = int(np.argmax(orig_powers))
        if peak_idx not in ds_indices:
            # Replace closest index with the peak index
            closest_idx = min(ds_indices, key=lambda x: abs(x - peak_idx))
            ds_indices[ds_indices.index(closest_idx)] = peak_idx
            ds_indices.sort()
            
        periods_ds = orig_periods[ds_indices]
        powers_ds = orig_powers[ds_indices]
        
        periodogram_points = [
            {"period": float(p), "power": float(pow_val)}
            for p, pow_val in zip(periods_ds, powers_ds)
            if not (np.isnan(p) or np.isnan(pow_val))
        ]
        
        # Phase Folded & Trapezoid overlay curve
        folded_points = [
            {
                "phase": float(p),
                "flux": float(f),
                "model": float(m)
            }
            for p, f, m in zip(fit_output.folded_lc.phase, fit_output.folded_lc.flux, fit_output.model_flux)
            if not (np.isnan(p) or np.isnan(f) or np.isnan(m))
        ]
        folded_points.sort(key=lambda x: x["phase"])
        if len(folded_points) > 1000:
            folded_points = folded_points[::(len(folded_points) // 1000)]
        
        # Stage 9: Calculate False Alarm Probability (FAP) & Follow-Up Index (PFI)
        # Empirical FAP approximation based on BLS Peak Sigma (peak_significance)
        # A Peak Sigma of 6.0 is the 50% FAP threshold, higher peak sigmas yield FAP -> 0.0
        import math
        fap = 1.0 / (1.0 + math.exp(1.5 * (bls_res.peak_significance - 6.0)))
        
        # PFI = XGBoost's Exoplanet Probability * log(Transit SNR) * (1 - FAP)
        transit_snr = features.get("transit_snr", 1.0)
        exoplanet_prob = prediction["probabilities"]["Planet"]
        log_snr = math.log(max(transit_snr, 1.01))
        pfi = exoplanet_prob * log_snr * (1.0 - fap)
        
        # Categorize priority based on PFI score & classification
        if prediction["class_label"] == "Planet":
            if pfi >= 1.2:
                priority = "HIGH"
                recommendation = "Highly Recommended for Telescope Follow-up"
            elif pfi >= 0.5:
                priority = "MEDIUM"
                recommendation = "Candidate Exoplanet: Secondary Target"
            else:
                priority = "LOW"
                recommendation = "Low Significance Exoplanet Candidate"
        elif prediction["class_label"] == "EB":
            priority = "LOW"
            recommendation = "Likely Eclipsing Binary: Check Alternating Depth"
        else:
            priority = "LOW"
            recommendation = "High False Alarm Probability / Instrumental Blend"

        # Build structure matching the frontend expect metrics tabs
        serializable_features = {
            k: float(v) if hasattr(v, 'item') else float(v)
            for k, v in full_features.items()
        }

        response = {
            "tic_id": int(bls_res.tic_id),
            "sectors": int(bls_res.number_of_sectors),
            "best_sector": int(bls_res.best_sector),
            "class_label": prediction["class_label"],
            "confidence": prediction["confidence"],
            "probabilities": prediction["probabilities"],
            "pfi": float(pfi),
            "fap": float(fap),
            "priority": priority,
            "recommendation": recommendation,
            "features": serializable_features,
            "metrics": {
                "bls": [
                    { "label": "Period", "value": f"{bls_res.detected_period:.4f} days", "description": "Transit repeat interval" },
                    { "label": "Transit Duration", "value": f"{bls_res.detected_duration:.4f} days", "description": "Full transit time width" },
                    { "label": "BLS Depth", "value": f"{bls_res.bls_depth:.5f}", "description": "Observed fractional dimming" },
                    { "label": "BLS Power", "value": f"{bls_res.bls_power:.2f}", "description": "Signal power spectral density" },
                    { "label": "Peak Sigma", "value": f"{bls_res.peak_significance:.2f}", "description": "Detection significance level" }
                ],
                "transit": [
                    { "label": "Depth", "value": f"{fit_output.parameters['depth_ppm']:.2f} ppm", "description": "Trapezoid model depth" },
                    { "label": "Transit Duration", "value": f"{fit_output.parameters['T_tot_hours']:.3f} hours", "description": "Fitted transit window width" },
                    { "label": "Ingress Duration", "value": f"{fit_output.parameters['T_in_hours']:.3f} hours", "description": "Time spent entering/exiting" },
                    { "label": "Ingress Phase", "value": f"{fit_output.parameters['ingress_phase']:.4f}", "description": "Ingress width in phase units" },
                    { "label": "Reduced Chi Square", "value": f"{fit_output.parameters['red_chi2']:.4f}", "description": "Goodness-of-fit statistic" }
                ],
                "physics": [
                    { "label": "Ingress Fraction", "value": f"{features['ingress_fraction']:.4f}", "description": "Ingress duration over total duration" },
                    { "label": "Flat Bottom Fraction", "value": f"{features['flat_bottom_fraction']:.4f}", "description": "Flat eclipse duration over total" },
                    { "label": "Transit SNR", "value": f"{features['transit_snr']:.2f}", "description": "Ratio of depth to out-of-transit noise" },
                    { "label": "Secondary Depth", "value": f"{features['secondary_depth']:.1f} ppm", "description": "Fitted secondary eclipse depth" },
                    { "label": "Secondary SNR", "value": f"{features['secondary_snr']:.2f}", "description": "Secondary detection significance" },
                    { "label": "Duty Cycle", "value": f"{features['duty_cycle']:.4f}", "description": "Orbit fraction spent in transit" },
                    { "label": "OOT RMS", "value": f"{features['oot_rms']:.5f}", "description": "Out-of-transit noise level" },
                    { "label": "Transit RMS", "value": f"{features['transit_rms']:.5f}", "description": "In-transit noise level" },
                    { "label": "Shape RMSE", "value": f"{features['shape_rmse']:.5f}", "description": "Transit left/right reflection residual" },
                    { "label": "Transit Skewness", "value": f"{features['transit_skewness']:.4f}", "description": "In-transit skewness profile" },
                    { "label": "Transit Kurtosis", "value": f"{features['transit_kurtosis']:.4f}", "description": "In-transit flatness shape factor" }
                ]
            },
            "originalCurve": orig_points,
            "detrendedCurve": det_points,
            "periodogram": periodogram_points,
            "foldedCurve": folded_points,
            "best_period": float(bls_res.detected_period),
            "best_power": float(bls_res.bls_power),
            "bls_min_period": float(bls_detector.min_period),
            "bls_max_period": float(bls_detector.max_period),
            "bls_number_of_periods": int(bls_detector.number_of_periods),
            "bls_number_of_durations": int(bls_detector.number_of_durations),
            "bls_min_duration": float(bls_detector.min_duration),
            "bls_max_duration": float(bls_detector.max_duration)
        }
        
        return jsonify(sanitize_json_value(response))
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
