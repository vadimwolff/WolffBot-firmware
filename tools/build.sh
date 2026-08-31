#!/usr/bin/env bash
#
# WolffBot reproducible firmware build.
#
# Builds firmware/WolffBot/WolffBot.ino for the Seeed Studio XIAO ESP32S3 with
# the stock Arduino IDE defaults, then stages the resulting binaries (and a
# single-file factory image) into web-flasher/public/firmware/ together with a
# manifest.json that records offsets, sizes and hashes.
#
# Requirements: arduino-cli (>= 1.0), python3, an internet connection on the
# first run (to download the ESP32 core and the U8g2 library).
#
# Usage:
#   tools/build.sh              # build + stage binaries
#   tools/build.sh --deps-only  # only install the pinned toolchain/libraries
#
# WolffBot is a modified fork of DASAI Mochi by upiir (MIT, (c) 2025 upir).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ---------------------------------------------------------------------------
# Pinned versions. Change these deliberately - they define the firmware build.
# ---------------------------------------------------------------------------
ESP32_CORE_VERSION="3.3.9"
U8G2_VERSION="2.37.1"
FQBN="esp32:esp32:XIAO_ESP32S3"          # all menu options left at their defaults
ESP32_INDEX_URL="https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json"

SKETCH_DIR="${REPO_ROOT}/firmware/WolffBot"
BUILD_DIR="${REPO_ROOT}/build"
OUT_DIR="${REPO_ROOT}/web-flasher/public/firmware"

ARDUINO_CLI="${ARDUINO_CLI:-arduino-cli}"

if ! command -v "${ARDUINO_CLI}" >/dev/null 2>&1; then
  echo "error: arduino-cli not found. Install it from https://arduino.github.io/arduino-cli/" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
install_deps() {
  echo "==> Installing esp32:esp32@${ESP32_CORE_VERSION} and U8g2@${U8G2_VERSION}"
  "${ARDUINO_CLI}" config init --overwrite >/dev/null 2>&1 || true
  "${ARDUINO_CLI}" config set board_manager.additional_urls "${ESP32_INDEX_URL}"
  "${ARDUINO_CLI}" core update-index
  "${ARDUINO_CLI}" core install "esp32:esp32@${ESP32_CORE_VERSION}"
  "${ARDUINO_CLI}" lib install "U8g2@${U8G2_VERSION}"
}

if [[ "${1:-}" == "--deps-only" ]]; then
  install_deps
  exit 0
fi

if ! "${ARDUINO_CLI}" core list 2>/dev/null | grep -q "esp32:esp32"; then
  install_deps
fi

# ---------------------------------------------------------------------------
# Compile
# ---------------------------------------------------------------------------
echo "==> Building ${SKETCH_DIR} for ${FQBN}"
rm -rf "${BUILD_DIR}"
"${ARDUINO_CLI}" compile --fqbn "${FQBN}" --build-path "${BUILD_DIR}" "${SKETCH_DIR}"

echo
echo "==> Flash layout reported by the Arduino ESP32 core (build/flash_args):"
cat "${BUILD_DIR}/flash_args"
echo

# ---------------------------------------------------------------------------
# Stage binaries
# ---------------------------------------------------------------------------
mkdir -p "${OUT_DIR}"
cp "${BUILD_DIR}/WolffBot.ino.bootloader.bin" "${OUT_DIR}/WolffBot-bootloader.bin"
cp "${BUILD_DIR}/WolffBot.ino.partitions.bin" "${OUT_DIR}/WolffBot-partitions.bin"
cp "${BUILD_DIR}/boot_app0.bin"               "${OUT_DIR}/boot_app0.bin"
cp "${BUILD_DIR}/WolffBot.ino.bin"            "${OUT_DIR}/WolffBot-app.bin"

# Single-file factory image, written at offset 0x0. Not padded to the full 8 MB
# (the core's own *.merged.bin is), so it stays small enough to ship on a static
# site. The offsets below are the ones printed in build/flash_args above.
ESPTOOL="$(find "$("${ARDUINO_CLI}" config get directories.data)/packages/esp32/tools/esptool_py" \
            -maxdepth 2 -name esptool -type f 2>/dev/null | head -n 1 || true)"
if [[ -z "${ESPTOOL}" ]]; then
  ESPTOOL="$(command -v esptool.py || command -v esptool || true)"
fi
if [[ -z "${ESPTOOL}" ]]; then
  echo "error: esptool not found; cannot build the factory image" >&2
  exit 1
fi

echo "==> Creating factory image with ${ESPTOOL}"
"${ESPTOOL}" --chip esp32s3 merge-bin -o "${OUT_DIR}/WolffBot-factory.bin" \
  --flash-mode keep --flash-freq keep --flash-size keep \
  0x0     "${BUILD_DIR}/WolffBot.ino.bootloader.bin" \
  0x8000  "${BUILD_DIR}/WolffBot.ino.partitions.bin" \
  0xe000  "${BUILD_DIR}/boot_app0.bin" \
  0x10000 "${BUILD_DIR}/WolffBot.ino.bin"

# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------
echo "==> Writing manifest.json"
ESP32_CORE_VERSION="${ESP32_CORE_VERSION}" \
U8G2_VERSION="${U8G2_VERSION}" \
ARDUINO_CLI_VERSION="$("${ARDUINO_CLI}" version --format json | python3 -c 'import json,sys;print(json.load(sys.stdin)["VersionString"])')" \
OUT_DIR="${OUT_DIR}" REPO_ROOT="${REPO_ROOT}" \
python3 "${REPO_ROOT}/tools/make_manifest.py"

echo
echo "==> Done. Staged binaries:"
ls -l "${OUT_DIR}"
