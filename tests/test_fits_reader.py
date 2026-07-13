import unittest
import os
import tempfile
import numpy as np
import pandas as pd
from astropy.io import fits
from src.pipeline.fits_reader import read_tess_fits

class TestFitsReader(unittest.TestCase):
    def test_read_tess_fits(self):
        # Create mock primary HDU with headers
        primary_hdu = fits.PrimaryHDU()
        primary_hdu.header['TICID'] = 58466459
        primary_hdu.header['SECTOR'] = 10

        # Define time series data columns
        time_data = np.array([1569.436731, 1569.438120, 1569.439508], dtype=np.float64)
        flux_data = np.array([10308.7, 10309.1, np.nan], dtype=np.float32)
        flux_err_data = np.array([14.4, 14.5, np.nan], dtype=np.float32)
        quality_data = np.array([8360, 8224, 0], dtype=np.int32)
        cadence_data = np.array([246223, 246224, 246225], dtype=np.int32)

        time_col = fits.Column(name='TIME', format='D', array=time_data)
        flux_col = fits.Column(name='PDCSAP_FLUX', format='E', array=flux_data)
        flux_err_col = fits.Column(name='PDCSAP_FLUX_ERR', format='E', array=flux_err_data)
        quality_col = fits.Column(name='QUALITY', format='J', array=quality_data)
        cadence_col = fits.Column(name='CADENCENO', format='J', array=cadence_data)

        cols = fits.ColDefs([time_col, flux_col, flux_err_col, quality_col, cadence_col])
        tb_hdu = fits.BinTableHDU.from_columns(cols, name='LIGHTCURVE')

        hdul = fits.HDUList([primary_hdu, tb_hdu])

        # Create temporary file matching the TESS filename structure
        with tempfile.NamedTemporaryFile(suffix='-s0010-0000000058466459-0140-s_lc.fits', delete=False) as tmp:
            tmp_path = tmp.name
            hdul.writeto(tmp_path, overwrite=True)

        try:
            # 1. Test reading with path (regex extracts sector)
            df = read_tess_fits(tmp_path)
            self.assertEqual(df.shape, (3, 8))
            self.assertEqual(df['TIC_ID'].iloc[0], 58466459)
            self.assertEqual(df['Sector'].iloc[0], 10)
            self.assertEqual(df['Label'].iloc[0], 'Unknown')
            self.assertAlmostEqual(df['Time'].iloc[0], 1569.436731)
            self.assertAlmostEqual(df['Flux'].iloc[0], 10308.7)
            self.assertTrue(np.isnan(df['Flux'].iloc[2]))
            
            # Verify data types match expectations (using subdtype to avoid endianness mismatch)
            self.assertTrue(np.issubdtype(df['TIC_ID'].dtype, np.integer))
            self.assertTrue(np.issubdtype(df['Sector'].dtype, np.integer))
            self.assertTrue(np.issubdtype(df['Time'].dtype, np.floating))
            self.assertEqual(df['Time'].dtype.itemsize, 8)
            self.assertTrue(np.issubdtype(df['Flux'].dtype, np.floating))
            self.assertEqual(df['Flux'].dtype.itemsize, 4)
            self.assertTrue(np.issubdtype(df['Flux_Error'].dtype, np.floating))
            self.assertEqual(df['Flux_Error'].dtype.itemsize, 4)
            self.assertTrue(np.issubdtype(df['Quality'].dtype, np.integer))
            self.assertEqual(df['Quality'].dtype.itemsize, 4)
            self.assertTrue(np.issubdtype(df['Cadence'].dtype, np.integer))
            self.assertEqual(df['Cadence'].dtype.itemsize, 4)

            # 2. Test reading with custom label
            df_labeled = read_tess_fits(tmp_path, label='EB')
            self.assertEqual(df_labeled['Label'].iloc[0], 'EB')

            # 3. Test fallback to header SECTOR when regex fails
            # Rename the file to not contain the sector pattern
            simple_tmp_path = tmp_path.replace('-s0010-', '-')
            os.rename(tmp_path, simple_tmp_path)
            tmp_path = simple_tmp_path

            df_no_regex = read_tess_fits(tmp_path)
            self.assertEqual(df_no_regex['Sector'].iloc[0], 10)  # Extracted from header

        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

if __name__ == '__main__':
    unittest.main()
