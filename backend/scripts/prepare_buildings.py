#!/usr/bin/env python3
"""Download Microsoft building footprints and create a Rogue Valley FlatGeobuf file.

Usage:
    python scripts/prepare_buildings.py [--all-oregon]

By default, filters to the Rogue Valley bounding box (~30-50MB output).
With --all-oregon, keeps the entire state (~800MB output).
"""

import io
import json
import sys
import zipfile
from pathlib import Path
from urllib.request import urlretrieve

import geopandas as gpd
import pandas as pd
from shapely.geometry import shape

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DOWNLOAD_URL = "https://minedbuildings.z5.web.core.windows.net/legacy/usbuildings-v2/Oregon.geojson.zip"

# Rogue Valley bounding box: SW corner to NE corner
ROGUE_VALLEY_BBOX = (-123.8, 41.9, -122.0, 42.95)


def download_oregon_zip(dest: Path) -> Path:
    """Download the Oregon GeoJSONL zip file."""
    zip_path = dest / "Oregon.geojson.zip"
    if zip_path.exists():
        print(f"  Already downloaded: {zip_path}")
        return zip_path
    print(f"  Downloading from {DOWNLOAD_URL} ...")
    urlretrieve(DOWNLOAD_URL, zip_path)
    print(f"  Downloaded: {zip_path} ({zip_path.stat().st_size / 1e6:.1f} MB)")
    return zip_path


def extract_and_filter(zip_path: Path, bbox: tuple | None) -> gpd.GeoDataFrame:
    """Extract GeoJSON from zip and read with geopandas, filtering by bbox."""
    import tempfile

    print(f"  Extracting zip ...")
    with zipfile.ZipFile(zip_path) as zf:
        names = [n for n in zf.namelist() if n.endswith(".geojsonl") or n.endswith(".geojson") or n.endswith(".json")]
        if not names:
            raise FileNotFoundError(f"No geojson file found in {zip_path}")
        fname = names[0]

        # Extract to a temp file so geopandas can read it with bbox filter
        with tempfile.TemporaryDirectory() as tmpdir:
            extracted = Path(tmpdir) / fname
            print(f"  Extracting {fname} ...")
            zf.extract(fname, tmpdir)

            print(f"  Reading with geopandas (bbox={bbox}) ...")
            if bbox:
                gdf = gpd.read_file(extracted, bbox=bbox)
            else:
                gdf = gpd.read_file(extracted)

    print(f"  Read {len(gdf)} buildings")
    return gdf


def main():
    all_oregon = "--all-oregon" in sys.argv

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print("Step 1: Download Oregon building footprints")
    zip_path = download_oregon_zip(DATA_DIR)

    print("Step 2: Parse and filter")
    bbox = None if all_oregon else ROGUE_VALLEY_BBOX
    gdf = extract_and_filter(zip_path, bbox)

    if len(gdf) == 0:
        print("ERROR: No buildings found in the bounding box!")
        sys.exit(1)

    output_name = "oregon_buildings.fgb" if all_oregon else "rogue_valley_buildings.fgb"
    output_path = DATA_DIR / output_name

    print(f"Step 3: Write FlatGeobuf ({len(gdf)} buildings) -> {output_path}")
    gdf.to_file(output_path, driver="FlatGeobuf")
    print(f"  Written: {output_path} ({output_path.stat().st_size / 1e6:.1f} MB)")

    # Clean up zip
    print("Step 4: Cleanup")
    zip_path.unlink()
    print("  Removed zip file")

    print(f"\nDone! {len(gdf)} Rogue Valley buildings saved to {output_path}")


if __name__ == "__main__":
    main()
