import numpy as np
import pandas as pd
import scipy.stats
from src.pipeline.phase_folding import PhaseFolder

class FeatureExtractor:
    def __init__(self, min_points: int = 5):
        self.min_points = min_points
        self.phase_folder = PhaseFolder()

    def ingress_fraction(self, t_in: float, t_tot: float) -> float:
        """Fraction of total transit duration spent in ingress/egress."""
        if not (t_tot > 0) or np.isnan(t_tot) or np.isnan(t_in):
            return np.nan
        return t_in / t_tot

    def flat_bottom_fraction(self, t_in: float, t_tot: float) -> float:
        """Fraction of total transit duration spent in flat bottom."""
        if not (t_tot > 0) or np.isnan(t_tot) or np.isnan(t_in):
            return np.nan
        return (t_tot - 2.0 * t_in) / t_tot

    def duty_cycle(self, t_tot: float, period: float) -> float:
        """Fraction of orbital period spent in transit."""
        if not (period > 0) or np.isnan(period) or np.isnan(t_tot):
            return np.nan
        return t_tot / (24.0 * period)

    def extract_shape_features(self, phase: np.ndarray, flux: np.ndarray, duration_phase: float) -> dict:
        """Extracts transit SNR, secondary eclipse depth (in ppm) and SNR."""
        transit = np.abs(phase) <= duration_phase / 2.0
        
        if transit.sum() < self.min_points:
            return {
                "transit_snr": np.nan,
                "secondary_depth": np.nan,
                "secondary_snr": np.nan
            }

        oot = ~transit
        sigma_oot = np.std(flux[oot])
        
        if sigma_oot <= 0 or np.isnan(sigma_oot):
            transit_snr = np.nan
            secondary_depth = np.nan
            secondary_snr = np.nan
        else:
            baseline = np.median(flux[oot])
            transit_depth = baseline - np.median(flux[transit])
            transit_snr = transit_depth / sigma_oot
            
            # Secondary Eclipse
            secondary = np.abs(np.abs(phase) - 0.5) <= duration_phase / 2.0
            if secondary.sum() >= self.min_points:
                raw_secondary_depth = max(0.0, baseline - np.median(flux[secondary]))
                secondary_depth = raw_secondary_depth * 1e6
                secondary_snr = raw_secondary_depth / sigma_oot
            else:
                secondary_depth = np.nan
                secondary_snr = np.nan

        return {
            "transit_snr": transit_snr,
            "secondary_depth": secondary_depth,
            "secondary_snr": secondary_snr
        }

    def compute_odd_even_ratio(self, time: np.ndarray, flux: np.ndarray, period: float, epoch: float, duration_phase: float) -> float:
        """Folds light curve at double period to compute ratio of odd/even transit depth."""
        # Fold at 2 * period
        phase_2p = self.phase_folder.phase_fold(time, period * 2.0, epoch)
        
        # Clean data (similar to V1 filtering)
        good = np.isfinite(flux)
        good &= np.abs(flux) < 5.0
        
        phase_2p = phase_2p[good]
        flux_clean = flux[good]
        
        duration = duration_phase / 2.0
        odd = np.abs(phase_2p) <= duration / 2.0
        even = np.abs(np.abs(phase_2p) - 0.5) <= duration / 2.0
        
        if odd.sum() < self.min_points or even.sum() < self.min_points:
            return np.nan
            
        odd_depth = np.median(flux_clean[~odd]) - np.median(flux_clean[odd])
        even_depth = np.median(flux_clean[~even]) - np.median(flux_clean[even])
        
        if even_depth <= 0:
            return np.nan
        return odd_depth / even_depth

    def extract_depth_symmetry(self, phase: np.ndarray, flux: np.ndarray, transit_mask: np.ndarray) -> dict:
        """Computes RMSE of left/right asymmetry of the transit folded shape."""
        transit_phase = phase[transit_mask]
        transit_flux = flux[transit_mask]
        
        left_mask = transit_phase < 0
        right_mask = transit_phase > 0
        
        left_phase = transit_phase[left_mask]
        left_flux = transit_flux[left_mask]
        right_phase = transit_phase[right_mask]
        right_flux = transit_flux[right_mask]
        
        if left_mask.sum() < self.min_points or right_mask.sum() < self.min_points:
            return {"shape_rmse": np.nan}
            
        abs_left_phase = np.abs(left_phase)
        abs_right_phase = np.abs(right_phase)
        
        # Sort right phase and flux by absolute phase for interpolation
        right_sort_idx = np.argsort(abs_right_phase)
        sorted_abs_right = abs_right_phase[right_sort_idx]
        sorted_right_flux = right_flux[right_sort_idx]
        
        # Interpolate right flux at abs_left_phase
        right_flux_interp = np.interp(abs_left_phase, sorted_abs_right, sorted_right_flux)
        
        # RMSE
        shape_rmse = np.sqrt(np.mean((left_flux - right_flux_interp) ** 2))
        return {"shape_rmse": shape_rmse}

    def extract_local_variability_features(self, flux: np.ndarray, transit_mask: np.ndarray) -> dict:
        """Computes standard deviation of out-of-transit (oot_rms) and in-transit (transit_rms)."""
        oot_mask = ~transit_mask
        
        if oot_mask.sum() < self.min_points:
            oot_rms = np.nan
        else:
            oot_rms = np.std(flux[oot_mask])
            
        if transit_mask.sum() < self.min_points:
            transit_rms = np.nan
        else:
            transit_rms = np.std(flux[transit_mask])
            
        return {
            "oot_rms": oot_rms,
            "transit_rms": transit_rms
        }

    def extract_transit_statistics(self, flux: np.ndarray, transit_mask: np.ndarray) -> dict:
        """Computes statistical shape moments of in-transit flux (skewness, kurtosis, MAD, IQR)."""
        transit_flux = flux[transit_mask]
        
        if len(transit_flux) < self.min_points:
            return {
                "transit_skewness": np.nan,
                "transit_kurtosis": np.nan,
                "transit_mad": np.nan,
                "transit_iqr": np.nan
            }
            
        skewness = scipy.stats.skew(transit_flux)
        kurtosis = scipy.stats.kurtosis(transit_flux)
        median = np.median(transit_flux)
        mad = np.median(np.abs(transit_flux - median))
        iqr = scipy.stats.iqr(transit_flux)
        
        return {
            "transit_skewness": skewness,
            "transit_kurtosis": kurtosis,
            "transit_mad": mad,
            "transit_iqr": iqr
        }

    def extract_all_features(
        self,
        df_preprocessed: pd.DataFrame,
        period_days: float,
        epoch_days: float,
        duration_days: float,
        t_tot_hours: float,
        t_in_hours: float
    ) -> dict:
        """Computes all 14 physics and statistical shape features from preprocessed lightcurve data."""
        time = df_preprocessed["Time"].values
        flux = df_preprocessed["Normalized_Flux"].values
        flux_error = df_preprocessed["Normalized_Flux_Error"].values
        
        # Prepare folded lightcurve
        phase = self.phase_folder.phase_fold(time, period_days, epoch_days)
        
        good = np.isfinite(flux)
        good &= np.isfinite(flux_error)
        good &= flux_error > 0
        good &= np.abs(flux) < 5.0
        
        phase = phase[good]
        flux = flux[good]
        flux_error = flux_error[good]
        
        phase, flux, flux_error = self.phase_folder.sort_phase(phase, flux, flux_error)
        
        duration_phase = duration_days / period_days
        transit_mask = np.abs(phase) <= duration_phase / 2.0
        
        # Compute individual categories
        formulas = {
            "ingress_fraction": self.ingress_fraction(t_in_hours, t_tot_hours),
            "flat_bottom_fraction": self.flat_bottom_fraction(t_in_hours, t_tot_hours),
            "duty_cycle": self.duty_cycle(t_tot_hours, period_days)
        }
        
        shape = self.extract_shape_features(phase, flux, duration_phase)
        odd_even = self.compute_odd_even_ratio(time, flux, period_days, epoch_days, duration_phase)
        local_var = self.extract_local_variability_features(flux, transit_mask)
        symmetry = self.extract_depth_symmetry(phase, flux, transit_mask)
        stats = self.extract_transit_statistics(flux, transit_mask)
        
        # Merge all into final features dict
        return {
            "ingress_fraction": formulas["ingress_fraction"],
            "flat_bottom_fraction": formulas["flat_bottom_fraction"],
            "transit_snr": shape["transit_snr"],
            "odd_even_ratio": odd_even,
            "secondary_depth": shape["secondary_depth"],
            "secondary_snr": shape["secondary_snr"],
            "duty_cycle": formulas["duty_cycle"],
            "oot_rms": local_var["oot_rms"],
            "transit_rms": local_var["transit_rms"],
            "shape_rmse": symmetry["shape_rmse"],
            "transit_skewness": stats["transit_skewness"],
            "transit_kurtosis": stats["transit_kurtosis"],
            "transit_mad": stats["transit_mad"],
            "transit_iqr": stats["transit_iqr"]
        }
