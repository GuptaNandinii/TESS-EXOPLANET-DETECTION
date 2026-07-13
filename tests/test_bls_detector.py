import unittest
import numpy as np
import pandas as pd
from src.pipeline.bls_detector import BLSDetector, BLSResult

class TestBLSDetector(unittest.TestCase):
    def setUp(self):
        # Create a detector with smaller grids for testing to run extremely fast
        self.detector = BLSDetector(
            min_period=1.0,
            max_period=5.0,
            min_duration=0.05,
            max_duration=0.15,
            number_of_periods=100,
            number_of_durations=5,
            min_points=50
        )

    def test_validate_input_missing_columns(self):
        # Missing required columns
        df = pd.DataFrame({
            "Time": [1.0, 2.0],
            "Normalized_Flux": [1.0, 1.0]
        })
        with self.assertRaises(ValueError):
            self.detector.validate_input(df)

    def test_validate_input_valid(self):
        df = pd.DataFrame({
            "Time": [1.0, 2.0],
            "Normalized_Flux": [1.0, 1.0],
            "Normalized_Flux_Error": [0.01, 0.01],
            "Sector": [1, 1],
            "TIC_ID": [12345, 12345],
            "Label": ["Planet", "Planet"]
        })
        # Should not raise any error
        self.detector.validate_input(df)

    def test_min_points_threshold(self):
        # Only 20 points, which is less than min_points=50
        df = pd.DataFrame({
            "Time": np.linspace(0, 5, 20),
            "Normalized_Flux": np.ones(20),
            "Normalized_Flux_Error": np.ones(20) * 0.01,
            "Sector": [1] * 20,
            "TIC_ID": [12345] * 20,
            "Label": ["Planet"] * 20
        })
        result = self.detector.detect(df)
        self.assertIsNone(result)

    def test_bls_detection_math(self):
        # Construct synthetic light curve with 100 points, period = 2.0, duration = 0.1, depth = 0.02
        np.random.seed(42)
        time = np.linspace(0, 10, 150)
        
        # Base flux of 1.0
        flux = np.ones_like(time)
        
        # Inject transits: period = 2.0, epoch = 1.0, duration = 0.10, depth = 0.02
        period = 2.0
        epoch = 1.0
        duration = 0.10
        depth = 0.02
        
        # Find points within transit duration
        phase = (time - epoch) % period
        in_transit = (phase < duration / 2.0) | (phase > period - duration / 2.0)
        flux[in_transit] -= depth
        
        # Add tiny photometric noise
        noise = np.random.normal(0, 0.001, len(time))
        flux += noise
        flux_err = np.ones_like(time) * 0.001

        df = pd.DataFrame({
            "Time": time,
            "Normalized_Flux": flux,
            "Normalized_Flux_Error": flux_err,
            "Sector": [1] * len(time),
            "TIC_ID": [9999] * len(time),
            "Label": ["Planet"] * len(time)
        })

        # Run detection using default or custom grids
        detector = BLSDetector(
            min_period=1.5,
            max_period=2.5,
            min_duration=0.08,
            max_duration=0.12,
            number_of_periods=500,
            number_of_durations=10,
            min_points=100
        )
        
        result = detector.detect(df)
        self.assertIsNotNone(result)
        self.assertIsInstance(result, BLSResult)
        
        # Period should be very close to injected 2.0
        self.assertAlmostEqual(result.detected_period, 2.0, delta=0.05)
        # Duration should be close to injected 0.10
        self.assertAlmostEqual(result.detected_duration, 0.10, delta=0.03)
        # Depth should be positive and close to injected 0.02
        self.assertAlmostEqual(result.bls_depth, 0.02, delta=0.005)
        # Epoch should be close to injected 1.0 or 3.0 or 5.0 (since period is 2.0)
        # We check phase fold representation or close value
        epoch_diff = (result.detected_epoch - epoch) % period
        self.assertTrue(epoch_diff < 0.1 or epoch_diff > period - 0.1)

    def test_multisector_selection(self):
        # Create data with two sectors: Sector 1 is noise, Sector 2 has a transit
        np.random.seed(42)
        time1 = np.linspace(0, 5, 80)
        flux1 = np.ones_like(time1) + np.random.normal(0, 0.001, len(time1))
        err1 = np.ones_like(time1) * 0.001

        time2 = np.linspace(10, 15, 80)
        flux2 = np.ones_like(time2)
        # Transit in sector 2: period = 3.0, epoch = 11.0, duration = 0.1, depth = 0.05
        phase = (time2 - 11.0) % 3.0
        in_transit = (phase < 0.05) | (phase > 2.95)
        flux2[in_transit] -= 0.05
        flux2 += np.random.normal(0, 0.001, len(time2))
        err2 = np.ones_like(time2) * 0.001

        df = pd.DataFrame({
            "Time": np.concatenate([time1, time2]),
            "Normalized_Flux": np.concatenate([flux1, flux2]),
            "Normalized_Flux_Error": np.concatenate([err1, err2]),
            "Sector": [1] * 80 + [2] * 80,
            "TIC_ID": [54321] * 160,
            "Label": ["Planet"] * 160
        })

        detector = BLSDetector(
            min_period=2.5,
            max_period=3.5,
            min_duration=0.08,
            max_duration=0.12,
            number_of_periods=200,
            number_of_durations=5,
            min_points=60
        )
        
        result = detector.detect(df)
        self.assertIsNotNone(result)
        # Sector 2 must be selected because it has the injected transit (higher BLS Power)
        self.assertEqual(result.best_sector, 2)
        self.assertEqual(result.number_of_sectors, 2)
        
        # Test to_dict helper
        res_dict = result.to_dict()
        self.assertEqual(res_dict["tic_id"], 54321)
        self.assertEqual(res_dict["best_sector"], 2)

if __name__ == '__main__':
    unittest.main()
