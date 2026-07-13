import numpy as np
import pandas as pd
from scipy.optimize import least_squares
from dataclasses import dataclass
from src.pipeline.phase_folding import PhaseFolder

@dataclass
class FoldedLightCurve:
    phase: np.ndarray
    flux: np.ndarray
    flux_error: np.ndarray

@dataclass
class TrapezoidFitOutput:
    folded_lc: FoldedLightCurve
    model_flux: np.ndarray
    parameters: dict

class TrapezoidFitter:
    def initial_guess(self, flux: np.ndarray, period: float, duration: float) -> tuple[float, float, float]:
        """
        Estimates initial guesses for the model params: depth, duration (in phase), and ingress.

        Parameters:
            flux (np.ndarray): Normalized flux array.
            period (float): Orbital period (days).
            duration (float): Estimated transit duration (days).

        Returns:
            tuple: (depth_guess, duration_phase, ingress_phase)
        """
        baseline = np.median(flux)
        minimum = np.min(flux)
        
        depth_guess = baseline - minimum
        depth_guess = np.clip(depth_guess, 1e-5, 0.95)

        duration_phase = duration / period
        ingress_phase = duration_phase / 5.0

        return depth_guess, duration_phase, ingress_phase

    def trapezoid_model(self, phase: np.ndarray, depth: float, duration: float, ingress: float) -> np.ndarray:
        """
        Generates a trapezoidal transit model light curve based on parameters.

        Parameters:
            phase (np.ndarray): Folded phase array.
            depth (float): Normalized transit depth.
            duration (float): Transit duration in phase.
            ingress (float): Ingress duration in phase.

        Returns:
            np.ndarray: Model flux values.
        """
        model = np.ones_like(phase)
        phase_abs = np.abs(phase)
        flat_half = duration / 2 - ingress

        # Flat Bottom (phase_abs <= flat_half)
        flat = phase_abs <= flat_half
        model[flat] -= depth

        # Ingress / Egress slope (flat_half < phase_abs <= duration / 2)
        edge = (phase_abs > flat_half) & (phase_abs <= duration / 2)
        # Prevent division by zero for ingress = 0
        if ingress > 0:
            model[edge] -= depth * (1.0 - (phase_abs[edge] - flat_half) / ingress)
        else:
            model[edge] -= depth

        return model

    def residual_function(self, parameters: np.ndarray, phase: np.ndarray, flux: np.ndarray, flux_error: np.ndarray) -> np.ndarray:
        """
        Weighted residuals function evaluated at parameters.

        Parameters:
            parameters (np.ndarray): Array [depth, duration_phase, ingress_phase].
            phase (np.ndarray): Phase values.
            flux (np.ndarray): Flux values.
            flux_error (np.ndarray): Flux error values.

        Returns:
            np.ndarray: Weighted residuals array.
        """
        depth, duration, ingress = parameters
        model = self.trapezoid_model(phase, depth, duration, ingress)
        return (flux - model) / flux_error

    def fit(self, phase: np.ndarray, flux: np.ndarray, flux_error: np.ndarray, period: float, duration: float):
        """
        Fits a trapezoidal transit model to the folded light curve using Levenberg-Marquardt least-squares optimization.

        Parameters:
            phase (np.ndarray): Folded phase values.
            flux (np.ndarray): Normalized flux values.
            flux_error (np.ndarray): Normalized flux error values.
            period (float): Orbital period (days).
            duration (float): Estimated transit duration (days).

        Returns:
            OptimizeResult: Scipy fit result.
        """
        # Initial Parameter Estimates
        depth_guess, duration_phase, ingress_phase = self.initial_guess(flux, period, duration)

        if len(phase) < 30:
            raise ValueError("Too few data points for fitting.")

        # Parameter Bounds
        lower = np.array([
            1e-6,
            duration_phase * 0.50,
            duration_phase * 0.05
        ])

        upper = np.array([
            1.00,
            duration_phase * 2.00,
            duration_phase * 0.50
        ])

        # Initial Guess
        x0 = np.array([
            depth_guess,
            duration_phase,
            ingress_phase
        ])

        epsilon = 1e-10
        x0 = np.clip(x0, lower + epsilon, upper - epsilon)

        # Least Squares Optimization
        result = least_squares(
            self.residual_function,
            x0=x0,
            bounds=(lower, upper),
            args=(phase, flux, flux_error)
        )
        return result

def fit_trapezoid_pipeline(df: pd.DataFrame, period: float, epoch: float, duration: float, best_sector: int) -> TrapezoidFitOutput:
    """
    Orchestrates the entire phase-folding, cropping, fitting, and feature extraction pipeline in-memory.

    Parameters:
        df (pd.DataFrame): Preprocessed light curve.
        period (float): Orbital period (days).
        epoch (float): Transit epoch (days).
        duration (float): Estimated transit duration (days).
        best_sector (int): The sector index chosen for fitting.

    Returns:
        TrapezoidFitOutput: Dataclass containing the folded light curve, best-fit model, and metrics.
    """
    # 1. Sector Filter
    lightcurve = df[df["Sector"] == best_sector].copy()

    # 2. Quality Filter
    lightcurve = lightcurve[lightcurve["Quality"] == 0].copy()

    if len(lightcurve) == 0:
        raise ValueError("No valid observations in selected sector.")

    # 3. Phase Folding
    phase_folder = PhaseFolder()
    raw_phase = phase_folder.phase_fold(lightcurve["Time"].values, period, epoch)
    raw_flux = lightcurve["Normalized_Flux"].values
    raw_flux_error = lightcurve["Normalized_Flux_Error"].values

    # 4. Clean non-finite and out-of-bounds observations
    good = np.isfinite(raw_flux) & np.isfinite(raw_flux_error)
    good &= (np.abs(raw_flux) < 5)
    good &= (raw_flux_error > 0)

    phase = raw_phase[good]
    flux = raw_flux[good]
    flux_error = raw_flux_error[good]

    # 5. Sort by phase
    phase, flux, flux_error = phase_folder.sort_phase(phase, flux, flux_error)

    # 6. Crop transit window
    phase, flux, flux_error = phase_folder.crop_transit_window(phase, flux, flux_error, period, duration)

    if len(phase) < 30:
        raise ValueError("Too few points inside transit window.")

    # 7. Fit Trapezoid
    fitter = TrapezoidFitter()
    fit_result = fitter.fit(phase, flux, flux_error, period, duration)

    # 8. Extract Parameters
    from src.pipeline.transit_parameters import TransitParameterExtractor
    extractor = TransitParameterExtractor()
    features = extractor.extract(fit_result, phase, flux, flux_error, period)

    # Separate parameters from model flux array
    model_flux = features["model_flux"]
    parameters = {k: v for k, v in features.items() if k != "model_flux"}

    return TrapezoidFitOutput(
        folded_lc=FoldedLightCurve(phase=phase, flux=flux, flux_error=flux_error),
        model_flux=model_flux,
        parameters=parameters
    )
