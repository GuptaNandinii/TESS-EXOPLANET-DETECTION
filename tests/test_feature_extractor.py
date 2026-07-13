import unittest
import numpy as np
import pandas as pd
from src.pipeline.feature_extractor import FeatureExtractor

class TestFeatureExtractor(unittest.TestCase):
    def setUp(self):
        self.extractor = FeatureExtractor(min_points=5)

    def test_formulas(self):
        # Good inputs
        self.assertAlmostEqual(self.extractor.ingress_fraction(0.3, 0.8), 0.375)
        self.assertAlmostEqual(self.extractor.flat_bottom_fraction(0.3, 0.8), 0.25)
        self.assertAlmostEqual(self.extractor.duty_cycle(0.72, 1.5), 0.02)
        
        # Ingress / Flat Bottom with zero or NaN
        self.assertTrue(np.isnan(self.extractor.ingress_fraction(0.3, 0.0)))
        self.assertTrue(np.isnan(self.extractor.ingress_fraction(0.3, np.nan)))
        self.assertTrue(np.isnan(self.extractor.flat_bottom_fraction(0.3, np.nan)))
        
        # Duty cycle with zero or NaN
        self.assertTrue(np.isnan(self.extractor.duty_cycle(0.72, 0.0)))
        self.assertTrue(np.isnan(self.extractor.duty_cycle(np.nan, 1.5)))

    def test_shape_features(self):
        # Create a mock transit around phase 0 (duration_phase = 0.1)
        phase = np.linspace(-0.5, 0.5, 101)
        flux = np.ones_like(phase)
        
        # Inject transit depth of 0.01 (10,000 ppm)
        transit_mask = np.abs(phase) <= 0.05
        flux[transit_mask] = 0.99
        
        # Inject secondary eclipse at phase 0.5 with depth of 0.001 (1000 ppm)
        secondary_mask = np.abs(np.abs(phase) - 0.5) <= 0.05
        flux[secondary_mask] = 0.999
        
        # Out-of-transit noise standard deviation (excluding transit and secondary)
        non_transit = ~(transit_mask | secondary_mask)
        # Add very small noise so sigma_oot > 0
        flux[non_transit] += np.random.normal(0, 1e-6, non_transit.sum())
        
        res = self.extractor.extract_shape_features(phase, flux, 0.1)
        
        self.assertGreater(res["transit_snr"], 0.0)
        self.assertAlmostEqual(res["secondary_depth"], 1000.0, places=1)
        self.assertGreater(res["secondary_snr"], 0.0)

    def test_odd_even_ratio(self):
        # Period = 1.0, duration_phase = 0.1
        # Create times spanning multiple cycles
        time = np.linspace(0.0, 10.0, 1000)
        flux = np.ones_like(time)
        
        # Inject equal transits at every integer cycle (odd and even)
        # Transits occur around time = 0.5, 1.5, 2.5, ...
        # i.e., np.abs((time - 0.5) % 1.0) <= 0.05
        phase_1 = np.abs((time - 0.5) % 1.0 - 0.5)
        transit = phase_1 >= 0.45
        flux[transit] = 0.99
        
        ratio = self.extractor.compute_odd_even_ratio(time, flux, 1.0, 0.5, 0.1)
        # Depths are identical, so ratio should be close to 1.0
        self.assertAlmostEqual(ratio, 1.0, places=2)
        
        # Inject deeper odd transits than even transits
        # Odd transits: time = 0.5, 2.5, 4.5, 6.5, 8.5
        # Even transits: time = 1.5, 3.5, 5.5, 7.5, 9.5
        flux = np.ones_like(time)
        for i in range(10):
            center = 0.5 + float(i)
            mask = np.abs(time - center) <= 0.05
            if i % 2 == 0:  # Odd transit index (0, 2, 4...) -> depth 0.02
                flux[mask] = 0.98
            else:           # Even transit index (1, 3, 5...) -> depth 0.01
                flux[mask] = 0.99
                
        ratio_diff = self.extractor.compute_odd_even_ratio(time, flux, 1.0, 0.5, 0.1)
        self.assertAlmostEqual(ratio_diff, 2.0, places=1)

    def test_depth_symmetry(self):
        # Symmetric transit
        phase = np.linspace(-0.1, 0.1, 100)
        flux = np.ones_like(phase)
        # U-shaped transit symmetric around 0
        flux = 1.0 - 0.01 * np.exp(- (phase / 0.03) ** 2)
        
        transit_mask = np.abs(phase) <= 0.05
        res_sym = self.extractor.extract_depth_symmetry(phase, flux, transit_mask)
        # Should be extremely close to 0
        self.assertAlmostEqual(res_sym["shape_rmse"], 0.0, places=4)
        
        # Asymmetric transit
        flux_asym = flux.copy()
        # Add a bump on the right side of the transit (egress)
        flux_asym[phase > 0] += 0.005
        res_asym = self.extractor.extract_depth_symmetry(phase, flux_asym, transit_mask)
        self.assertGreater(res_asym["shape_rmse"], 1e-4)

    def test_statistics(self):
        # Generate some synthetic transit flux points
        transit_mask = np.ones(50, dtype=bool)
        # normal distribution
        np.random.seed(42)
        flux = np.random.normal(0.99, 0.001, 50)
        
        stats = self.extractor.extract_transit_statistics(flux, transit_mask)
        self.assertIn("transit_skewness", stats)
        self.assertIn("transit_kurtosis", stats)
        self.assertIn("transit_mad", stats)
        self.assertIn("transit_iqr", stats)
        
        # Too few points fallback
        few_mask = np.array([True, True])
        stats_few = self.extractor.extract_transit_statistics(flux[:2], few_mask)
        self.assertTrue(np.isnan(stats_few["transit_skewness"]))

    def test_pipeline_integration(self):
        # Generate mock preprocessed DataFrame
        np.random.seed(42)
        time = np.linspace(0.0, 10.0, 1000)
        # Injected period 2.5, epoch 0.1, duration 0.2
        # Let's inject a realistic looking transit of depth 0.01 (10,000 ppm)
        flux = np.ones_like(time)
        phase = ((time - 0.1) % 2.5) / 2.5
        phase = np.where(phase > 0.5, phase - 1.0, phase)
        
        # duration in phase is 0.2 / 2.5 = 0.08
        transit_mask = np.abs(phase) <= 0.04
        flux[transit_mask] = 0.99
        
        # Add noise
        flux += np.random.normal(0, 1e-4, len(flux))
        flux_error = np.ones_like(flux) * 1e-4
        
        df = pd.DataFrame({
            "Time": time,
            "Normalized_Flux": flux,
            "Normalized_Flux_Error": flux_error
        })
        
        features = self.extractor.extract_all_features(
            df_preprocessed=df,
            period_days=2.5,
            epoch_days=0.1,
            duration_days=0.2,
            t_tot_hours=4.8,
            t_in_hours=1.2
        )
        
        self.assertEqual(len(features), 14)
        self.assertAlmostEqual(features["ingress_fraction"], 0.25)
        self.assertAlmostEqual(features["flat_bottom_fraction"], 0.5)
        self.assertAlmostEqual(features["duty_cycle"], 0.08)
        self.assertGreater(features["transit_snr"], 5.0)
        self.assertTrue(features["shape_rmse"] >= 0.0)

if __name__ == '__main__':
    unittest.main()
