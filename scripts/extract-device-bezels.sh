#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMDECK_ROOT="${SIMDECK_ROOT:-${HOME}/Developer/SimDeck}"
OUTPUT_DIR="${1:-${WORKSPACE_DIR}/assets/device-bezels}"
BUILD_DIR="${TMPDIR:-/tmp}/framedeck-device-bezel-extractor"
EXTRACTOR="${BUILD_DIR}/extract-device-bezels"

if [[ ! -f "${SIMDECK_ROOT}/cli/XCWChromeRenderer.m" ]]; then
  echo "Unable to find SimDeck's XCWChromeRenderer.m at ${SIMDECK_ROOT}/cli." >&2
  echo "Set SIMDECK_ROOT=/path/to/SimDeck and try again." >&2
  exit 1
fi

mkdir -p "${BUILD_DIR}"

clang \
  -fobjc-arc \
  -I "${SIMDECK_ROOT}/cli" \
  "${SCRIPT_DIR}/extract-device-bezels.m" \
  "${SIMDECK_ROOT}/cli/XCWChromeRenderer.m" \
  -framework Foundation \
  -framework AppKit \
  -framework CoreGraphics \
  -framework ImageIO \
  -o "${EXTRACTOR}"

"${EXTRACTOR}" "${OUTPUT_DIR}"
