import re
import pandas as pd
from astropy.io import fits

def read_tess_fits(file_path_or_buf, filename=None, label="Unknown"):
    """
    Reads a calibrated TESS FITS light curve file and extracts the required
    scientific time-series data and metadata into a structured in-memory DataFrame.

    Parameters:
        file_path_or_buf (str or file-like object): Path to the FITS file, or an open file-like object.
        filename (str, optional): The name of the file. Used to extract the sector number.
        label (str, optional): The exoplanet label for the star (e.g., 'EB', 'PC', 'Unknown'). Defaults to 'Unknown'.

    Returns:
        pd.DataFrame: A structured DataFrame with columns:
                      ['TIC_ID', 'Label', 'Sector', 'Time', 'Flux', 'Flux_Error', 'Quality', 'Cadence']
    """
    # Use context manager to ensure FITS file is closed properly
    with fits.open(file_path_or_buf) as hdul:
        # Extract TIC ID from primary header
        primary_header = hdul[0].header
        tic_id = primary_header.get("TICID")
        if tic_id is not None:
            tic_id = int(tic_id)
        else:
            tic_id = -1

        # Extract Sector number from filename or primary header
        sector = -1
        
        # 1. Try filename (if provided) using the notebook's regex pattern: -s(\d{4})-
        search_target = filename if filename else (file_path_or_buf if isinstance(file_path_or_buf, str) else None)
        if search_target:
            match = re.search(r"-s(\d{4})-", search_target)
            if match:
                sector = int(match.group(1))
            else:
                # Fallback to broader notebook regex: s(\d{4})
                match_broad = re.search(r"s(\d{4})", search_target)
                if match_broad:
                    sector = int(match_broad.group(1))

        # 2. Fallback to primary header if not extracted from filename
        if sector == -1:
            sector = primary_header.get("SECTOR", -1)

        # Read light curve data extension (HDU 1)
        lc_data = hdul[1].data
        df = pd.DataFrame(lc_data)

        # Assemble the structured DataFrame as per scientific steps in the notebook
        structured = pd.DataFrame({
            "TIC_ID": tic_id,
            "Label": label,
            "Sector": sector,
            "Time": df["TIME"],
            "Flux": df["PDCSAP_FLUX"],
            "Flux_Error": df["PDCSAP_FLUX_ERR"],
            "Quality": df["QUALITY"],
            "Cadence": df["CADENCENO"]
        })

        return structured
