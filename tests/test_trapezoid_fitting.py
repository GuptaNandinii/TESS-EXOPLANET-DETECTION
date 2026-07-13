import unittest
import numpy as np
import pandas as pd
from src.pipeline.phase_folding import PhaseFolder
from src.pipeline.trapezoid_fit import TrapezoidFitter, fit_trapezoid_pipeline, TrapezoidFitOutput
from src.pipeline.transit_parameters import TransitParameterExtractor

class TestTrapezoidFitting(unittest.TestCase):
    def setUp(self):
        self.phase_folder = PhaseFolder()
        self.fitter = TrapezoidFitter()
        self.extractor = TransitParameterExtractor()

    def test_phase_folding(self):
        time = np.array([1.0, 2.0, 3.0])
        period = 2.0
        epoch = 1.0
        # Folds to ((time - 1.0 + 1.0) % 2.0) / 2.0 - 0.5
        # 1.0 -> (1.0 % 2.0)/2 - 0.5 = 0.5 - 0.5 = 0.0
        # 2.0 -> (2.0 % 2.0)/2 - 0.5 = 0.0 - 0.5 = -0.5
        # 3.0 -> (3.0 % 2.0)/2 - 0.5 = 0.5 - 0.5 = 0.0
        phase = self.phase_folder.phase_fold(time, period, epoch)
        self.assertEqual(len(phase), 3)
        self.assertAlmostEqual(phase[0], 0.0)
        self.assertAlmostEqual(phase[1], -0.5)
        self.assertAlmostEqual(phase[2], 0.0)

    def test_sort_phase(self):
        phase = np.array([0.2, -0.1, 0.0])
        flux = np.array([1.0, 2.0, 3.0])
        err = np.array([0.1, 0.2, 0.3])
        s_p, s_f, s_e = self.phase_folder.sort_phase(phase, flux, err)
        np.testing.assert_array_equal(s_p, np.array([-0.1, 0.0, 0.2]))
        np.testing.assert_array_equal(s_f, np.array([2.0, 3.0, 1.0]))
        np.testing.assert_array_equal(s_e, np.array([0.2, 0.3, 0.1]))

    def test_crop_transit_window(self):
        phase = np.linspace(-0.5, 0.5, 101)
        flux = np.ones_like(phase)
        err = np.ones_like(phase) * 0.01
        
        # duration = 0.1, period = 1.0 -> duration_phase = 0.1. Crop window is 3 * 0.1 = 0.3
        # Keeps phase in [-0.3, 0.3]
        c_p, c_f, c_e = self.phase_folder.crop_transit_window(phase, flux, err, period=1.0, duration=0.1)
        self.assertTrue(np.all(c_p >= -0.3 - 1e-9))
        self.assertTrue(np.all(c_p <= 0.3 + 1e-9))
        # Total points in [-0.3, 0.3] out of 101 points spanning [-0.5, 0.5] should be 61
        self.assertEqual(len(c_p), 61)

    def test_trapezoid_model_flat_bottom(self):
        # Generate model with depth = 0.02, duration_phase = 0.1, ingress_phase = 0.02
        # flat_half = 0.05 - 0.02 = 0.03
        phase = np.array([-0.06, -0.04, -0.02, 0.0, 0.02, 0.04, 0.06])
        model = self.fitter.trapezoid_model(phase, depth=0.02, duration=0.1, ingress=0.02)
        
        # At phase = 0.0: flat bottom, model = 1.0 - 0.02 = 0.98
        self.assertAlmostEqual(model[3], 0.98)
        # At phase = 0.02: flat bottom, model = 0.98
        self.assertAlmostEqual(model[2], 0.98)
        self.assertAlmostEqual(model[4], 0.98)
        
        # At phase = -0.04 (in ingress slope: 0.03 < abs(phase) <= 0.05):
        # ingress slope: model = 1.0 - depth * (1 - (abs(phase) - flat_half)/ingress)
        # model = 1.0 - 0.02 * (1 - (0.04 - 0.03)/0.02) = 1.0 - 0.02 * (1 - 0.5) = 1.0 - 0.01 = 0.99
        self.assertAlmostEqual(model[1], 0.99)
        self.assertAlmostEqual(model[5], 0.99)
        
        # At phase = 0.06 (out-of-transit: abs(phase) > 0.05): model = 1.0
        self.assertAlmostEqual(model[0], 1.0)
        self.assertAlmostEqual(model[6], 1.0)

    def test_fit_trapezoid_pipeline_success(self):
        # Create a mock DataFrame with a clean transit signal
        # Period = 2.0 days, Epoch = 1.0 day, Duration = 0.1 days, Ingress = 0.02 days, Depth = 0.01 (10000 ppm)
        np.random.seed(42)
        time = np.linspace(0, 10, 400)
        flux = np.ones_like(time)
        
        period = 2.0
        epoch = 1.0
        duration = 0.1
        ingress = 0.02
        depth = 0.01
        
        # Fold time
        phase = ((time - epoch + 0.5 * period) % period) / period - 0.5
        # Generate transit slope
        phase_abs = np.abs(phase)
        flat_half = (duration / period) / 2 - (ingress / period)
        flat = phase_abs <= flat_half
        flux[flat] -= depth
        edge = (phase_abs > flat_half) & (phase_abs <= (duration / period) / 2)
        flux[edge] -= depth * (1.0 - (phase_abs[edge] - flat_half) / (ingress / period))
        
        # Add tiny noise
        flux += np.random.normal(0, 0.0001, len(time))
        flux_err = np.ones_like(time) * 0.0001

        df = pd.DataFrame({
            "Time": time,
            "Normalized_Flux": flux,
            "Normalized_Flux_Error": flux_err,
            "Sector": [1] * len(time),
            "Quality": [0] * len(time),
            "TIC_ID": [12345] * len(time),
            "Label": ["Planet"] * len(time)
        })

        # Run pipeline
        output = fit_trapezoid_pipeline(df, period=period, epoch=epoch, duration=duration, best_sector=1)
        
        self.assertIsNotNone(output)
        self.assertIsInstance(output, TrapezoidFitOutput)
        
        # Verify parameters match injected values within tolerances
        self.assertAlmostEqual(output.parameters["depth_ppm"], 10000.0, delta=200.0)
        self.assertAlmostEqual(output.parameters["T_tot_hours"], 0.1 * 24, delta=0.2)
        self.assertAlmostEqual(output.parameters["T_in_hours"], 0.02 * 24, delta=0.1)
        self.assertTrue(output.parameters["red_chi2"] > 0)
        self.assertTrue(output.parameters["rms_resid"] < 0.005)

    def test_fit_trapezoid_pipeline_too_few_points(self):
        # Only 5 points, which will be less than the required 30 points in the transit window
        df = pd.DataFrame({
            "Time": np.linspace(0, 10, 5),
            "Normalized_Flux": np.ones(5),
            "Normalized_Flux_Error": np.ones(5) * 0.01,
            "Sector": [1] * 5,
            "Quality": [0] * 5,
            "TIC_ID": [12345] * 5,
            "Label": ["Planet"] * 5
        })
        with self.assertRaises(ValueError):
            fit_trapezoid_pipeline(df, period=2.0, epoch=1.0, duration=0.1, best_sector=1)

if __name__ == '__main__':
    unittest.main()
