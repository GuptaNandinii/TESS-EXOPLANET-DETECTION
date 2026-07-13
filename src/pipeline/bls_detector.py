import numpy as np
import pandas as pd
from astropy.timeseries import BoxLeastSquares
from dataclasses import dataclass, asdict

@dataclass
class BLSResult:
    tic_id: int
    label: str
    number_of_sectors: int
    best_sector: int
    detected_period: float
    detected_duration: float
    detected_epoch: float
    bls_depth: float
    bls_power: float
    peak_significance: float
    periods: np.ndarray = None
    powers: np.ndarray = None

    def to_dict(self):
        d = asdict(self)
        if "periods" in d:
            del d["periods"]
        if "powers" in d:
            del d["powers"]
        return d

class BLSDetector:
    def __init__(self, min_period=0.5, max_period=15.0, min_duration=0.03, max_duration=0.25,
                 number_of_periods=6000, number_of_durations=50, min_points=100):
        """
        Initializes the BLSDetector with TESS search parameters.

        Parameters:
            min_period (float): Minimum trial period in days. Defaults to 0.5.
            max_period (float): Maximum trial period in days. Defaults to 15.0.
            min_duration (float): Minimum transit duration in days. Defaults to 0.03.
            max_duration (float): Maximum transit duration in days. Defaults to 0.25.
            number_of_periods (int): Number of periods in the search grid. Defaults to 6000.
            number_of_durations (int): Number of durations in the search grid. Defaults to 50.
            min_points (int): Minimum number of valid observations required to run BLS. Defaults to 100.
        """
        self.min_period = min_period
        self.max_period = max_period
        self.min_duration = min_duration
        self.max_duration = max_duration
        self.number_of_periods = number_of_periods
        self.number_of_durations = number_of_durations
        self.min_points = min_points

        # Pre-compute the search grids to avoid re-allocation in loops
        self.period_grid = self.create_period_grid()
        self.duration_grid = self.create_duration_grid()

    def create_period_grid(self):
        """
        Creates a fixed linear period search grid exactly as in the notebook.

        Returns:
            np.ndarray: Linear grid of periods.
        """
        return np.linspace(self.min_period, self.max_period, self.number_of_periods)

    def create_duration_grid(self):
        """
        Creates a fixed linear duration search grid exactly as in the notebook.

        Returns:
            np.ndarray: Linear grid of transit durations.
        """
        return np.linspace(self.min_duration, self.max_duration, self.number_of_durations)

    def validate_input(self, df):
        """
        Validates that the input preprocessed DataFrame contains all required columns.

        Parameters:
            df (pd.DataFrame): The preprocessed light curve DataFrame.

        Raises:
            ValueError: If any required column is missing.
        """
        required_cols = ["Time", "Normalized_Flux", "Normalized_Flux_Error", "Sector", "TIC_ID", "Label"]
        missing = [col for col in required_cols if col not in df.columns]
        if missing:
            raise ValueError(f"Input DataFrame is missing required columns: {missing}")

    def run_bls(self, sector_df):
        """
        Runs Astropy's BoxLeastSquares on a single sector's time-series data.

        Parameters:
            sector_df (pd.DataFrame): Preprocessed DataFrame for a single sector.

        Returns:
            dict or None: Metrics dictionary for the strongest candidate or None if data size is insufficient.
        """
        time = sector_df["Time"].to_numpy(dtype=np.float64)
        flux = sector_df["Normalized_Flux"].to_numpy(dtype=np.float64)
        flux_error = sector_df["Normalized_Flux_Error"].to_numpy(dtype=np.float64)

        # Remove invalid values exactly as in the notebook
        valid = np.isfinite(time) & np.isfinite(flux) & np.isfinite(flux_error)
        time = time[valid]
        flux = flux[valid]
        flux_error = flux_error[valid]

        # Verify minimum number of observations threshold
        if len(time) < self.min_points:
            return None

        # Weighted BLS initialization and execution
        bls = BoxLeastSquares(t=time, y=flux, dy=flux_error)
        result = bls.power(self.period_grid, self.duration_grid)

        # Extract the strongest peak and metrics
        best = np.argmax(result.power)
        power = result.power
        std = np.std(power)

        if std == 0:
            peak_sig = 0.0
        else:
            peak_sig = (power[best] - np.mean(power)) / std

        return {
            "Detected_Period": float(result.period[best]),
            "Detected_Duration": float(result.duration[best]),
            "Detected_Epoch": float(result.transit_time[best]),
            "BLS_Depth": float(result.depth[best]),
            "BLS_Power": float(power[best]),
            "Peak_Significance": float(peak_sig),
            "periods": result.period,
            "powers": power
        }

    def detect(self, df):
        """
        Orchestrates Weighted BLS exoplanet transit candidate search across all sectors.

        Parameters:
            df (pd.DataFrame): Preprocessed light curve DataFrame.

        Returns:
            BLSResult or None: Best sector transit candidate results or None if no sectors had enough data.
        """
        self.validate_input(df)

        tic_id = int(df["TIC_ID"].iloc[0])
        label = str(df["Label"].iloc[0])
        sectors = sorted(df["Sector"].unique())

        best_power = -np.inf
        best_sector = None
        best_output = None

        for sector in sectors:
            sector_df = df[df["Sector"] == sector]
            output = self.run_bls(sector_df)

            if output is None:
                continue

            # Identify the sector showing the strongest periodic signal (highest BLS Power)
            if output["BLS_Power"] > best_power:
                best_power = output["BLS_Power"]
                best_sector = int(sector)
                best_output = output

        if best_output is None:
            return None

        return BLSResult(
            tic_id=tic_id,
            label=label,
            number_of_sectors=len(sectors),
            best_sector=best_sector,
            detected_period=best_output["Detected_Period"],
            detected_duration=best_output["Detected_Duration"],
            detected_epoch=best_output["Detected_Epoch"],
            bls_depth=best_output["BLS_Depth"],
            bls_power=best_output["BLS_Power"],
            peak_significance=best_output["Peak_Significance"],
            periods=best_output["periods"],
            powers=best_output["powers"]
        )
