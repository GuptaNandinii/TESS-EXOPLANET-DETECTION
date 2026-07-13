import os
import pickle
from typing import Union, Dict, Any, List
import numpy as np
import pandas as pd

EXPECTED_FEATURES = [
    'period_days', 'duration_days', 'bls_depth', 'bls_power', 'peak_sigma',
    'depth_ppm', 'T_tot_hours', 'T_in_hours', 'ingress_phase', 'red_chi2',
    'ingress_fraction', 'flat_bottom_fraction', 'transit_snr', 'secondary_depth',
    'secondary_snr', 'duty_cycle', 'oot_rms', 'transit_rms', 'shape_rmse',
    'transit_skewness', 'transit_kurtosis'
]

LABEL_MAP = {
    0: "Planet",
    1: "EB",
    2: "False Positive"
}

class ExoplanetClassifier:
    def __init__(self, model_path: str = None):
        if model_path is None:
            # Locate relative to the package directory structure: src/models/final_xgboost.pkl
            base_dir = os.path.dirname(os.path.dirname(__file__))
            model_path = os.path.join(base_dir, "models", "final_xgboost.pkl")
        self.model_path = model_path
        self.model = None

    def load_model(self) -> None:
        """Loads the pre-trained XGBoost model into memory exactly once."""
        if self.model is not None:
            return

        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Trained XGBoost model pickle file not found at: {self.model_path}")

        try:
            with open(self.model_path, 'rb') as f:
                self.model = pickle.load(f)
        except Exception as e:
            raise RuntimeError(f"Error loading the model from {self.model_path}: {str(e)}")

    def _prepare_features(self, feature_vector: Union[List[float], np.ndarray, Dict[str, float], pd.Series, pd.DataFrame]) -> pd.DataFrame:
        """Validates input feature vector dimensions, column presence, and enforces the correct order."""
        if isinstance(feature_vector, pd.DataFrame):
            # Check for missing columns
            missing = [col for col in EXPECTED_FEATURES if col not in feature_vector.columns]
            if missing:
                raise ValueError(f"Input DataFrame is missing required features: {missing}")
            # Reorder columns to match training order
            return feature_vector[EXPECTED_FEATURES]

        elif isinstance(feature_vector, pd.Series):
            missing = [col for col in EXPECTED_FEATURES if col not in feature_vector.index]
            if missing:
                raise ValueError(f"Input Series is missing required features: {missing}")
            # Convert series to DataFrame with matching columns order
            return pd.DataFrame([feature_vector[EXPECTED_FEATURES]])

        elif isinstance(feature_vector, dict):
            missing = [col for col in EXPECTED_FEATURES if col not in feature_vector]
            if missing:
                raise ValueError(f"Input dictionary is missing required features: {missing}")
            # Build 1-row DataFrame in the correct order
            row_data = {col: [feature_vector[col]] for col in EXPECTED_FEATURES}
            return pd.DataFrame(row_data)

        elif isinstance(feature_vector, (list, np.ndarray)):
            flat_vector = np.array(feature_vector).flatten()
            if len(flat_vector) != len(EXPECTED_FEATURES):
                raise ValueError(f"Expected exactly {len(EXPECTED_FEATURES)} features, but got {len(flat_vector)}.")
            # Convert list/array to DataFrame row
            row_data = {col: [val] for col, val in zip(EXPECTED_FEATURES, flat_vector)}
            return pd.DataFrame(row_data)

        else:
            raise TypeError("Unsupported feature vector type. Must be a List, np.ndarray, Dict, pd.Series, or pd.DataFrame.")

    def predict(self, feature_vector: Union[List[float], np.ndarray, Dict[str, float], pd.Series, pd.DataFrame]) -> int:
        """Predicts target class index (0, 1, or 2) for the given feature vector."""
        self.load_model()
        X = self._prepare_features(feature_vector)
        pred = self.model.predict(X)
        # Handle scalar vs array prediction output format
        if isinstance(pred, np.ndarray):
            return int(pred[0])
        return int(pred)

    def predict_proba(self, feature_vector: Union[List[float], np.ndarray, Dict[str, float], pd.Series, pd.DataFrame]) -> np.ndarray:
        """Predicts class probabilities array for the given feature vector."""
        self.load_model()
        X = self._prepare_features(feature_vector)
        probs = self.model.predict_proba(X)
        if len(probs.shape) > 1 and probs.shape[0] == 1:
            return probs[0]
        return probs

    def predict_class(self, feature_vector: Union[List[float], np.ndarray, Dict[str, float], pd.Series, pd.DataFrame]) -> Dict[str, Any]:
        """Predicts class label, predicted class confidence, and full class probability dict."""
        self.load_model()
        probs = self.predict_proba(feature_vector)
        pred_idx = int(np.argmax(probs))
        
        class_label = LABEL_MAP.get(pred_idx, "Unknown")
        confidence = float(probs[pred_idx])
        
        prob_dict = {
            LABEL_MAP[i]: float(probs[i]) for i in range(len(LABEL_MAP))
        }

        return {
            "class_label": class_label,
            "confidence": confidence,
            "probabilities": prob_dict
        }
