#!/usr/bin/env bash
#
# WolffBot <-> DASAI Mochi difference report.
#
# Proves the claim made in docs/WOLFFBOT_CHANGES.md: the WolffBot sketch differs
# from the upstream DASAI Mochi sketch by comment lines only, with no code,
# asset, GPIO, display, timing or state-machine changes.
#
# Usage: tools/compare_with_original.sh
#
# Exit status 0 means "no functional difference detected".

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ORIG="${REPO_ROOT}/original/esp32s3_oled_dasai_mochi/ARDUINO_xiao_oled_dasai_mochi/ARDUINO_xiao_oled_dasai_mochi.ino"
FORK="${REPO_ROOT}/firmware/WolffBot/WolffBot.ino"

status=0
fail() { echo "  FAIL: $*"; status=1; }
pass() { echo "  ok:   $*"; }

echo "WolffBot vs DASAI Mochi - difference report"
echo "==========================================="
echo

# ---------------------------------------------------------------------------
echo "1. Source files"
# ---------------------------------------------------------------------------
if [[ ! -f "${ORIG}" ]]; then
  echo "  FAIL: upstream snapshot missing at ${ORIG}"
  exit 1
fi

added=$(diff "${ORIG}" "${FORK}" | grep -c '^>' || true)
removed=$(diff "${ORIG}" "${FORK}" | grep -c '^<' || true)
echo "  lines added to the fork:     ${added}"
echo "  lines removed from upstream: ${removed}"
[[ "${removed}" -eq 0 ]] && pass "nothing removed from the upstream sketch" \
                         || fail "${removed} upstream line(s) removed"

# Every added line must be a comment (or blank).
noncomment=$(diff "${ORIG}" "${FORK}" | grep '^>' | sed 's/^> //' \
             | grep -vE '^\s*(//.*)?$' | wc -l | tr -d ' ')
[[ "${noncomment}" -eq 0 ]] && pass "every added line is a comment or blank" \
                            || fail "${noncomment} added line(s) contain code"

# ---------------------------------------------------------------------------
echo
echo "2. Code equivalence (comments and blank lines stripped)"
# ---------------------------------------------------------------------------
strip_comments() {
  # Remove // comments and blank lines; the sketch contains no /* */ blocks.
  sed 's://.*::' "$1" | sed 's/[[:space:]]*$//' | grep -v '^$'
}
if diff -q <(strip_comments "${ORIG}") <(strip_comments "${FORK}") >/dev/null; then
  pass "code is byte-identical after stripping comments"
else
  fail "code differs after stripping comments:"
  diff <(strip_comments "${ORIG}") <(strip_comments "${FORK}") | head -40
fi

# ---------------------------------------------------------------------------
echo
echo "3. Hardware / display / GPIO configuration"
# ---------------------------------------------------------------------------
for pattern in 'U8G2_SSD1306_128X64_NONAME_F_HW_I2C' 'U8G2_R0' 'U8X8_PIN_NONE' \
               '#include <U8g2lib.h>' '#include <Wire.h>' '#include <Arduino.h>'; do
  o=$(grep -cF -- "${pattern}" "${ORIG}")
  f=$(grep -cF -- "${pattern}" "${FORK}")
  [[ "${o}" -eq "${f}" ]] && pass "${pattern} (x${o})" || fail "${pattern}: upstream ${o}, fork ${f}"
done
echo "  note: the sketch sets no GPIO numbers of its own; I2C uses the Wire"
echo "        defaults of the XIAO_ESP32S3 variant (SDA=GPIO5, SCL=GPIO6)."

# ---------------------------------------------------------------------------
echo
echo "4. Animation data, timing and state machine"
# ---------------------------------------------------------------------------
o_frames=$(grep -cE '^const unsigned char epd_bitmap_[0-9]+ \[\] PROGMEM' "${ORIG}")
f_frames=$(grep -cE '^const unsigned char epd_bitmap_[0-9]+ \[\] PROGMEM' "${FORK}")
[[ "${o_frames}" -eq "${f_frames}" ]] && pass "frame bitmaps: ${f_frames}" \
                                      || fail "frame count: upstream ${o_frames}, fork ${f_frames}"

o_data=$(grep -cE '^\s*0x' "${ORIG}")
f_data=$(grep -cE '^\s*0x' "${FORK}")
[[ "${o_data}" -eq "${f_data}" ]] && pass "bitmap data lines: ${f_data}" \
                                  || fail "bitmap data lines: upstream ${o_data}, fork ${f_data}"

o_hash=$(grep -E '^\s*0x' "${ORIG}" | sha256sum | cut -d' ' -f1)
f_hash=$(grep -E '^\s*0x' "${FORK}" | sha256sum | cut -d' ' -f1)
[[ "${o_hash}" == "${f_hash}" ]] && pass "bitmap payload sha256 identical (${f_hash:0:16}...)" \
                                 || fail "bitmap payload differs"

for pattern in 'if (frame >= 90) {frame = 0;}' \
               'u8g2.drawXBMP(0, 0, 128, 64, epd_bitmap_allArray[frame]);' \
               'u8g2.clearBuffer();' 'u8g2.sendBuffer();' 'u8g2.begin();' \
               'const int epd_bitmap_allArray_LEN = 90;'; do
  o=$(grep -cF -- "${pattern}" "${ORIG}")
  f=$(grep -cF -- "${pattern}" "${FORK}")
  [[ "${o}" -eq "${f}" && "${f}" -ge 1 ]] && pass "${pattern}" \
                                          || fail "${pattern}: upstream ${o}, fork ${f}"
done

# Neither sketch may contain a delay - the frame rate is I2C-bound in both.
for f in "${ORIG}" "${FORK}"; do
  n=$(grep -cE '\b(delay|delayMicroseconds|vTaskDelay)\s*\(' "${f}")
  [[ "${n}" -eq 0 ]] || fail "$(basename "${f}") introduces a delay call"
done
pass "no delay()/timing calls in either sketch"

# ---------------------------------------------------------------------------
echo
echo "5. Upstream assets preserved"
# ---------------------------------------------------------------------------
for asset in RIVE_big_smile_animation.riv RIVE_big_smile_animation.gif \
             RIVE_big_smile_animation_4x.gif PHOTOPEA_big_smile.psd \
             PHOTOPEA_big_smile.png LICENSE README.md; do
  [[ -e "${REPO_ROOT}/original/esp32s3_oled_dasai_mochi/${asset}" ]] \
    && pass "original/esp32s3_oled_dasai_mochi/${asset}" \
    || fail "missing asset: ${asset}"
done
png_count=$(find "${REPO_ROOT}/original/esp32s3_oled_dasai_mochi/RIVE_animation_export_png_sequence" \
            -name '*.png' 2>/dev/null | wc -l | tr -d ' ')
[[ "${png_count}" -eq 90 ]] && pass "Rive PNG sequence: ${png_count} frames" \
                            || fail "Rive PNG sequence has ${png_count} frames, expected 90"

# ---------------------------------------------------------------------------
echo
echo "6. Licence and attribution"
# ---------------------------------------------------------------------------
grep -q 'Copyright (c) 2025 upir' "${REPO_ROOT}/LICENSE" \
  && pass "root LICENSE keeps the upstream copyright line" \
  || fail "root LICENSE lost the upstream copyright line"
grep -q 'MIT License' "${REPO_ROOT}/LICENSE" \
  && pass "root LICENSE is the MIT License" || fail "root LICENSE is not MIT"
diff -q "${REPO_ROOT}/LICENSE" \
        "${REPO_ROOT}/original/esp32s3_oled_dasai_mochi/LICENSE" >/dev/null \
  && pass "root LICENSE is byte-identical to the upstream LICENSE" \
  || fail "root LICENSE differs from the upstream LICENSE"
grep -q 'created by upir, 2025' "${FORK}" \
  && pass "fork sketch keeps upir's authorship line" || fail "fork sketch lost upir's authorship line"
grep -q 'https://github.com/upiir/esp32s3_oled_dasai_mochi' "${FORK}" \
  && pass "fork sketch links the upstream project" || fail "fork sketch lost the upstream link"

# ---------------------------------------------------------------------------
echo
echo "7. No AI / network / audio code added"
# ---------------------------------------------------------------------------
banned=$(grep -inE '\b(WiFi|HTTPClient|WebServer|BluetoothSerial|I2S|mic(rophone)?|speaker|openai|anthropic|xiaozhi|llm)\b' "${FORK}" | grep -v '^[0-9]*://' || true)
if [[ -z "${banned}" ]]; then
  pass "no networking, audio or AI symbols in the fork sketch"
else
  fail "unexpected symbols found:"; echo "${banned}" | head -5
fi

echo
echo "==========================================="
if [[ "${status}" -eq 0 ]]; then
  echo "RESULT: no functional difference detected between WolffBot and DASAI Mochi."
else
  echo "RESULT: differences detected - see FAIL lines above."
fi
exit "${status}"
