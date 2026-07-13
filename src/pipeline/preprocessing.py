import numpy as np
import pandas as pd
from scipy.signal import savgol_filter

class Preprocessor:
    def __init__(self, window_length=1001, polyorder=2):
        """
        Initializes the Preprocessor with parameters for the Savitzky-Golay detrending filter.

        Parameters:
            window_length (int): The length of the filter window. Defaults to 1001.
            polyorder (int): The order of the polynomial used to fit the samples. Defaults to 2.
        """
        self.window_length = window_length
        self.polyorder = polyorder

    def clean_dataframe(self, df):
        """
        Removes invalid observations where critical measurements are NaN.

        Parameters:
            df (pd.DataFrame): The input structured DataFrame.

        Returns:
            pd.DataFrame: Cleaned DataFrame with NaN values removed in Time, Flux, and Flux_Error.
        """
        return df.dropna(subset=["Time", "Flux", "Flux_Error"])

    def filter_quality_flags(self, df):
        """
        Filters out observations with bad quality flags (QUALITY != 0).

        Parameters:
            df (pd.DataFrame): The input DataFrame.

        Returns:
            pd.DataFrame: A copy of the DataFrame keeping only rows where Quality == 0.
        """
        return df[df["Quality"] == 0].copy()

    def estimate_baseline(self, flux, window_length):
        """
        Estimates the baseline trends using a Savitzky-Golay filter.
        Handles boundary cases for short sectors.

        Parameters:
            flux (np.ndarray): The raw flux values.
            window_length (int): The window length for the filter.

        Returns:
            tuple:
                - baseline (np.ndarray): The estimated baseline values.
                - applied_savgol (bool): True if Savitzky-Golay filter was applied, False if copied raw flux.
        """
        # Boundary adjustment for short data arrays
        if len(flux) <= window_length:
            window_length = len(flux) - 1

        if window_length % 2 == 0:
            window_length -= 1

        # Check if window length is too small to perform polynomial fit
        if window_length < 5:
            # Baseline is raw flux, normalized flux will be 1.0, detrended is 0.0
            return flux.copy(), False

        # Apply Savitzky-Golay filter
        baseline = savgol_filter(
            flux,
            window_length=window_length,
            polyorder=self.polyorder
        )

        # Prevent division by zero
        baseline = np.where(baseline == 0, np.nan, baseline)
        return baseline, True

    def normalize_flux(self, flux, baseline):
        """
        Normalizes the raw flux values by dividing by the baseline.

        Parameters:
            flux (np.ndarray): The raw flux values.
            baseline (np.ndarray): The estimated baseline values.

        Returns:
            np.ndarray: Normalized flux.
        """
        return flux / baseline

    def normalize_flux_error(self, flux_error, baseline):
        """
        Normalizes the raw flux uncertainty values by dividing by the baseline.

        Parameters:
            flux_error (np.ndarray): The raw flux error values.
            baseline (np.ndarray): The estimated baseline values.

        Returns:
            np.ndarray: Normalized flux error.
        """
        return flux_error / baseline

    def compute_detrended_flux(self, flux, baseline, applied_savgol):
        """
        Computes the detrended relative flux.

        Parameters:
            flux (np.ndarray): The raw flux values.
            baseline (np.ndarray): The estimated baseline values.
            applied_savgol (bool): Flag indicating if Savitzky-Golay was applied.

        Returns:
            np.ndarray: Detrended flux.
        """
        if not applied_savgol:
            return np.zeros_like(flux)
        return (flux - baseline) / baseline

    def process_sector(self, df_sector):
        """
        Preprocesses and detrends the light curve for a single TESS sector.

        Parameters:
            df_sector (pd.DataFrame): DataFrame of a single sector.

        Returns:
            pd.DataFrame: Copy of sector DataFrame with additional columns:
                          ['Baseline', 'Normalized_Flux', 'Normalized_Flux_Error', 'Detrended_Flux']
        """
        sector = df_sector.copy()
        flux = sector["Flux"].values
        flux_error = sector["Flux_Error"].values

        # Estimate baseline
        baseline, applied_savgol = self.estimate_baseline(flux, self.window_length)
        
        # Calculate normalizations and detrended values
        normalized_flux = self.normalize_flux(flux, baseline)
        normalized_flux_err = self.normalize_flux_error(flux_error, baseline)
        detrended_flux = self.compute_detrended_flux(flux, baseline, applied_savgol)

        sector["Baseline"] = baseline
        sector["Normalized_Flux"] = normalized_flux
        sector["Normalized_Flux_Error"] = normalized_flux_err
        sector["Detrended_Flux"] = detrended_flux

        return sector

    def preprocess(self, df):
        """
        Orchestrates the complete preprocessing pipeline on the input light curve.

        Parameters:
            df (pd.DataFrame): Input structured DataFrame from fits_reader.py.

        Returns:
            pd.DataFrame: The fully cleaned and detrended DataFrame ready for transit detection.
        """
        # Step 1: Clean NaN observations
        cleaned_df = self.clean_dataframe(df)

        # Step 2: Filter quality flags
        filtered_df = self.filter_quality_flags(cleaned_df)

        # Step 3: Process each sector independently
        sectors = []
        for sector_id in sorted(filtered_df["Sector"].unique()):
            sector_df = filtered_df[filtered_df["Sector"] == sector_id]
            processed_sector = self.process_sector(sector_df)
            sectors.append(processed_sector)

        if not sectors:
            # Return an empty DataFrame matching the output columns structure if no data
            empty_df = filtered_df.copy()
            empty_df["Baseline"] = pd.Series(dtype=np.float64)
            empty_df["Normalized_Flux"] = pd.Series(dtype=np.float64)
            empty_df["Normalized_Flux_Error"] = pd.Series(dtype=np.float64)
            empty_df["Detrended_Flux"] = pd.Series(dtype=np.float64)
            return empty_df

        # Step 4: Merge processed sectors
        return pd.concat(sectors, ignore_index=True)
