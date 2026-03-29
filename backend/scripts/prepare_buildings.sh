#!/usr/bin/env bash
# Download Microsoft building footprints for Oregon and convert to FlatGeobuf.
#
# Prerequisites: ogr2ogr (from GDAL), wget/curl, unzip
#   brew install gdal   # macOS
#   apt-get install gdal-bin   # Debian/Ubuntu
#
# Usage:
#   ./scripts/prepare_buildings.sh [--rogue-valley]
#
# The --rogue-valley flag clips to the Rogue Valley bounding box (~30-50MB vs ~800MB).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="${SCRIPT_DIR}/../data"
mkdir -p "$DATA_DIR"

DOWNLOAD_URL="https://minedbuildings.z5.web.core.windows.net/legacy/usbuildings-v2/Oregon.geojson.zip"
ZIP_FILE="$DATA_DIR/Oregon.geojsonl.zip"
GEOJSONL_FILE="$DATA_DIR/Oregon.geojsonl"
OUTPUT_FILE="$DATA_DIR/oregon_buildings.fgb"

# Rogue Valley bounding box (Jackson + Josephine counties, generous)
# minx, miny, maxx, maxy
RV_BBOX="-123.8 41.9 -122.0 42.95"

CLIP_TO_RV=false
for arg in "$@"; do
  case "$arg" in
    --rogue-valley) CLIP_TO_RV=true ;;
  esac
done

echo "=== Fire Shield — Building Footprint Data Preparation ==="
echo ""

# Step 1: Download
if [ -f "$GEOJSONL_FILE" ]; then
  echo "✓ Oregon.geojsonl already exists, skipping download"
else
  echo "→ Downloading Oregon building footprints (~300MB compressed)..."
  if command -v wget &>/dev/null; then
    wget -O "$ZIP_FILE" "$DOWNLOAD_URL"
  else
    curl -L -o "$ZIP_FILE" "$DOWNLOAD_URL"
  fi
  echo "→ Extracting..."
  unzip -o "$ZIP_FILE" -d "$DATA_DIR"
  rm -f "$ZIP_FILE"
  echo "✓ Downloaded and extracted"
fi

# Step 2: Convert to FlatGeobuf
echo ""
if [ "$CLIP_TO_RV" = true ]; then
  OUTPUT_FILE="$DATA_DIR/rogue_valley_buildings.fgb"
  echo "→ Converting to FlatGeobuf (Rogue Valley subset: $RV_BBOX)..."
  ogr2ogr -f FlatGeobuf "$OUTPUT_FILE" "$GEOJSONL_FILE" \
    -spat $RV_BBOX \
    -lco SPATIAL_INDEX=YES \
    -progress
else
  echo "→ Converting to FlatGeobuf (full Oregon — this may take a few minutes)..."
  ogr2ogr -f FlatGeobuf "$OUTPUT_FILE" "$GEOJSONL_FILE" \
    -lco SPATIAL_INDEX=YES \
    -progress
fi

echo ""
echo "✓ Done! Output: $OUTPUT_FILE"
echo "  Size: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo ""
echo "To use the Rogue Valley subset (recommended for development):"
echo "  ./scripts/prepare_buildings.sh --rogue-valley"
