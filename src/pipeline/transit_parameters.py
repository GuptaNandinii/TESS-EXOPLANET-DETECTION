import numpy as np

class TransitParameterExtractor:
    def extract(self, fit_result, phase: np.ndarray, flux: np.ndarray, flux_error: np.ndarray, period: float) -> dict:
        """
        Converts fitted model parameters into physics-based transit parameters and fit statistics.

        Parameters:
            fit_result (OptimizeResult): The fit result object returned by scipy.optimize.least_squares.
            phase (np.ndarray): Phase values within the cropped window.
            flux (np.ndarray): Normalized flux values within the cropped window.
            flux_error (np.ndarray): Normalized flux error values within the cropped window.
            period (float): Orbital period (days).

        Returns:
            dict: Dictionary containing transit parameters, statistics, and model flux:
                  ['depth_ppm', 'T_tot_hours', 'T_in_hours', 'duration_phase', 'ingress_phase',
                   'red_chi2', 'rms_resid', 'model_flux']
        """
        depth = fit_result.x[0]
        duration_phase = fit_result.x[1]
        ingress_phase = fit_result.x[2]

        # Calculate model flux using TrapezoidFitter's model function
        from src.pipeline.trapezoid_fit import TrapezoidFitter
        fitter = TrapezoidFitter()
        model_flux = fitter.trapezoid_model(phase, depth, duration_phase, ingress_phase)

        # Compute residuals
        residual = flux - model_flux

        # Calculate goodness-of-fit statistics (exactly matching the notebook)
        dof = len(flux) - 3
        if dof > 0:
            red_chi2 = np.sum((residual / flux_error) ** 2) / dof
        else:
            red_chi2 = np.nan

        rms_residual = np.sqrt(np.mean(residual ** 2))

        return {
            "depth_ppm": depth * 1e6,
            "T_tot_hours": duration_phase * period * 24.0,
            "T_in_hours": ingress_phase * period * 24.0,
            "duration_phase": duration_phase,
            "ingress_phase": ingress_phase,
            "red_chi2": red_chi2,
            "rms_resid": rms_residual,
            "model_flux": model_flux
        }
