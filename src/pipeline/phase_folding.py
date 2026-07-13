import numpy as np

class PhaseFolder:
    def phase_fold(self, time: np.ndarray, period: float, epoch: float) -> np.ndarray:
        """
        Folds time-series observations using the orbital period and transit epoch.

        Parameters:
            time (np.ndarray): Observation times (days).
            period (float): Orbital period (days).
            epoch (float): Transit epoch (days).

        Returns:
            np.ndarray: Phase values centered in the range [-0.5, 0.5].
        """
        phase = ((time - epoch + 0.5 * period) % period) / period
        return phase - 0.5

    def sort_phase(self, phase: np.ndarray, flux: np.ndarray, flux_error: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Sorts the phase-folded light curve observations in ascending order of phase.

        Parameters:
            phase (np.ndarray): Folded phase values.
            flux (np.ndarray): Normalized flux values.
            flux_error (np.ndarray): Normalized flux error values.

        Returns:
            tuple: Sorted (phase, flux, flux_error) arrays.
        """
        order = np.argsort(phase)
        return phase[order], flux[order], flux_error[order]

    def crop_transit_window(self, phase: np.ndarray, flux: np.ndarray, flux_error: np.ndarray,
                            period: float, duration: float, multiplier: float = 3.0) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Crops the light curve to keep only observations inside a designated window
        around the transit event (centered at phase 0.0).

        Parameters:
            phase (np.ndarray): Sorted phase values.
            flux (np.ndarray): Normalized flux values.
            flux_error (np.ndarray): Normalized flux error values.
            period (float): Orbital period (days).
            duration (float): Estimated transit duration (days).
            multiplier (float): The multiplier factor of transit duration to crop around. Defaults to 3.0.

        Returns:
            tuple: Cropped (phase, flux, flux_error) arrays.
        """
        duration_phase = duration / period
        window = multiplier * duration_phase
        mask = np.abs(phase) <= window
        return phase[mask], flux[mask], flux_error[mask]
