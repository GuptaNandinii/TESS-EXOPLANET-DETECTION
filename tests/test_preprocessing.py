import unittest
import numpy as np
import pandas as pd
from src.pipeline.preprocessing import Preprocessor

class TestPreprocessor(unittest.TestCase):
    def setUp(self):
        # Initialize default preprocessor
        self.preprocessor = Preprocessor(window_length=1001, polyorder=2)

    def test_clean_dataframe(self):
        df = pd.DataFrame({
            "Time": [1.0, np.nan, 3.0, 4.0],
            "Flux": [100.0, 101.0, np.nan, 103.0],
            "Flux_Error": [1.0, 1.1, 1.2, np.nan],
            "Quality": [0, 0, 0, 0]
        })
        cleaned = self.preprocessor.clean_dataframe(df)
        self.assertEqual(len(cleaned), 1)
        self.assertEqual(cleaned["Time"].iloc[0], 1.0)

    def test_filter_quality_flags(self):
        df = pd.DataFrame({
            "Time": [1.0, 2.0, 3.0],
            "Flux": [100.0, 101.0, 102.0],
            "Flux_Error": [1.0, 1.1, 1.2],
            "Quality": [0, 128, 0]
        })
        filtered = self.preprocessor.filter_quality_flags(df)
        self.assertEqual(len(filtered), 2)
        self.assertEqual(filtered["Time"].iloc[0], 1.0)
        self.assertEqual(filtered["Time"].iloc[1], 3.0)

    def test_estimate_baseline_normal(self):
        # Construct large synthetic light curve to support window_length = 1001
        np.random.seed(42)
        time = np.linspace(0, 10, 2000)
        # Baseline trend + noise
        trend = 0.5 * time
        noise = np.random.normal(0, 0.01, len(time))
        flux = 1000.0 + trend + noise

        baseline, applied = self.preprocessor.estimate_baseline(flux, window_length=1001)
        self.assertTrue(applied)
        self.assertEqual(len(baseline), len(flux))
        # Estimated baseline should be smooth and close to trend
        self.assertAlmostEqual(np.mean(baseline - 1000.0 - trend), 0.0, places=1)

    def test_estimate_baseline_fallback_short(self):
        # Short data length (e.g., 50 points)
        flux = np.ones(50) * 100.0
        baseline, applied = self.preprocessor.estimate_baseline(flux, window_length=1001)
        
        # Window length adjusted: 50 -> len <= 1001 -> window_length = len - 1 = 49 (which is odd)
        self.assertTrue(applied)
        self.assertEqual(len(baseline), 50)
        np.testing.assert_array_almost_equal(baseline, flux)

    def test_estimate_baseline_fallback_tiny(self):
        # Extremely short data length (e.g. 3 points)
        flux = np.array([100.0, 101.0, 102.0])
        baseline, applied = self.preprocessor.estimate_baseline(flux, window_length=1001)
        
        # Window length adjusted: 3 -> len-1 = 2 -> even -> odd = 1.
        # Since window length < 5, filter is not applied.
        self.assertFalse(applied)
        np.testing.assert_array_equal(baseline, flux)

    def test_process_sector(self):
        # Test sector calculations
        df_sector = pd.DataFrame({
            "Time": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0],
            "Flux": [10.0, 10.0, 10.0, 10.0, 10.0, 10.0],
            "Flux_Error": [0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
            "Quality": [0, 0, 0, 0, 0, 0]
        })
        
        # Using a small window for short test
        preprocessor = Preprocessor(window_length=5, polyorder=2)
        processed = preprocessor.process_sector(df_sector)

        # Baseline of constant 10.0 is 10.0
        np.testing.assert_array_almost_equal(processed["Baseline"].values, 10.0)
        # Normalized flux should be constant 1.0 (Flux / Baseline)
        np.testing.assert_array_almost_equal(processed["Normalized_Flux"].values, 1.0)
        # Normalized flux error should be (Flux_Error / Baseline) = 0.1 / 10 = 0.01
        np.testing.assert_array_almost_equal(processed["Normalized_Flux_Error"].values, 0.01)
        # Detrended flux should be constant 0.0 ((Flux - Baseline) / Baseline)
        np.testing.assert_array_almost_equal(processed["Detrended_Flux"].values, 0.0)

    def test_preprocess_integration(self):
        # Multi-sector mock DataFrame
        df = pd.DataFrame({
            "TIC_ID": [12345] * 8,
            "Label": ["PC"] * 8,
            "Sector": [1, 1, 1, 1, 2, 2, 2, 2],
            "Time": [1.0, 2.0, np.nan, 4.0, 5.0, 6.0, 7.0, 8.0],
            "Flux": [10.0, 10.0, 10.0, 10.0, 20.0, 20.0, 20.0, np.nan],
            "Flux_Error": [0.1, 0.1, 0.1, np.nan, 0.2, 0.2, 0.2, 0.2],
            "Quality": [0, 128, 0, 0, 0, 0, 8, 0]
        })
        
        preprocessor = Preprocessor(window_length=5, polyorder=2)
        result = preprocessor.preprocess(df)
        
        # In sector 1:
        # Row 0: Valid, Quality=0
        # Row 1: Valid, Quality=128 (dropped)
        # Row 2: Time=NaN (dropped)
        # Row 3: Flux_Error=NaN (dropped)
        # Sector 1 has 1 row left. Due to len < 5, savgol fallback applies.
        
        # In sector 2:
        # Row 4: Valid, Quality=0
        # Row 5: Valid, Quality=0
        # Row 6: Valid, Quality=8 (dropped)
        # Row 7: Flux=NaN (dropped)
        # Sector 2 has 2 rows left.
        
        self.assertEqual(len(result), 3) # 1 from sector 1, 2 from sector 2
        self.assertEqual(result["Sector"].iloc[0], 1)
        self.assertEqual(result["Sector"].iloc[1], 2)
        self.assertEqual(result["Sector"].iloc[2], 2)

if __name__ == '__main__':
    unittest.main()
