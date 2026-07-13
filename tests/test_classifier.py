import unittest
import numpy as np
import pandas as pd
from src.pipeline.classifier import ExoplanetClassifier, EXPECTED_FEATURES

class TestExoplanetClassifier(unittest.TestCase):
    def setUp(self):
        self.classifier = ExoplanetClassifier()

    def test_invalid_model_path(self):
        bad_classifier = ExoplanetClassifier(model_path="nonexistent_model.pkl")
        with self.assertRaises(FileNotFoundError):
            bad_classifier.predict([0.0]*21)

    def test_input_validation_errors(self):
        # 1. List of wrong length
        with self.assertRaises(ValueError):
            self.classifier._prepare_features([0.0] * 20)
            
        with self.assertRaises(ValueError):
            self.classifier._prepare_features([0.0] * 22)
            
        # 2. Dictionary missing key
        bad_dict = {feat: 1.0 for feat in EXPECTED_FEATURES}
        del bad_dict['period_days']
        with self.assertRaises(ValueError):
            self.classifier._prepare_features(bad_dict)

        # 3. DataFrame missing columns
        bad_df = pd.DataFrame([[0.0] * 20], columns=EXPECTED_FEATURES[1:])
        with self.assertRaises(ValueError):
            self.classifier._prepare_features(bad_df)

        # 4. Incorrect type
        with self.assertRaises(TypeError):
            self.classifier._prepare_features("string_instead_of_list")

    def test_input_reordering(self):
        # Create dictionary in reverse order
        reversed_features = list(reversed(EXPECTED_FEATURES))
        test_dict = {feat: float(i) for i, feat in enumerate(reversed_features)}
        
        df = self.classifier._prepare_features(test_dict)
        self.assertEqual(df.columns.tolist(), EXPECTED_FEATURES)
        
        # Verify values align with EXPECTED_FEATURES order
        expected_val = float(reversed_features.index(EXPECTED_FEATURES[0]))
        self.assertAlmostEqual(df.iloc[0][EXPECTED_FEATURES[0]], expected_val)

    def test_predict_eb_mock(self):
        # Row 0 from V2 training dataset (corresponds to EB)
        eb_features = {
            'period_days': 0.942324,
            'duration_days': 0.075,
            'bls_depth': 0.007126,
            'bls_power': 928.753290,
            'peak_sigma': 13.017379,
            'depth_ppm': 7566.254198,
            'T_tot_hours': 3.571631,
            'T_in_hours': 0.502542,
            'ingress_phase': 0.002863,
            'red_chi2': 0.965778,
            'ingress_fraction': 0.316427,
            'flat_bottom_fraction': 0.367147,
            'transit_snr': 4.386221,
            'secondary_depth': 584.814466,
            'secondary_snr': 0.096849,
            'duty_cycle': 0.103831,
            'oot_rms': 0.005761,
            'transit_rms': 0.006450,
            'shape_rmse': 0.009890,
            'transit_skewness': -0.193433,
            'transit_kurtosis': 0.170547
        }
        
        # Test predict
        pred_idx = self.classifier.predict(eb_features)
        self.assertEqual(pred_idx, 0)
        
        # Test predict_proba
        probs = self.classifier.predict_proba(eb_features)
        self.assertEqual(len(probs), 3)
        self.assertAlmostEqual(np.sum(probs), 1.0, places=4)
        
        # Test predict_class
        res = self.classifier.predict_class(eb_features)
        self.assertEqual(res["class_label"], "Planet")
        self.assertEqual(res["confidence"], probs[0])
        self.assertAlmostEqual(res["probabilities"]["Planet"], probs[0])

    def test_predict_planet_mock(self):
        # Row 2 from V2 training dataset (corresponds to Planet)
        planet_features = {
            'period_days': 4.280297,
            'duration_days': 0.114,
            'bls_depth': 0.005744,
            'bls_power': 2436.410323,
            'peak_sigma': 14.040970,
            'depth_ppm': 10147.148822,
            'T_tot_hours': 0.790838,
            'T_in_hours': 0.304673,
            'ingress_phase': 0.014394,
            'red_chi2': 0.996196,
            'ingress_fraction': 0.385253,
            'flat_bottom_fraction': 0.229493,
            'transit_snr': 0.381656,
            'secondary_depth': 253.630337,
            'secondary_snr': 0.139124,
            'duty_cycle': 0.029782,
            'oot_rms': 0.001933,
            'transit_rms': 0.002059,
            'shape_rmse': 0.002368,
            'transit_skewness': 0.114596,
            'transit_kurtosis': -0.136550
        }
        
        pred_idx = self.classifier.predict(planet_features)
        self.assertEqual(pred_idx, 2)
        
        res = self.classifier.predict_class(planet_features)
        self.assertEqual(res["class_label"], "False Positive")

if __name__ == '__main__':
    unittest.main()
