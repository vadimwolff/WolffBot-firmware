# WolffBot — every change relative to DASAI Mochi

Baseline: upstream commit `71ecb80e27af6f94aa453fe98e25a8bb557a7f18` of
https://github.com/upiir/esp32s3_oled_dasai_mochi, kept verbatim in
[`original/esp32s3_oled_dasai_mochi/`](../original/esp32s3_oled_dasai_mochi/).

Run [`tools/compare_with_original.sh`](../tools/compare_with_original.sh) to
re-verify every claim on this page against the two source trees.

---

## Summary

| Category | Count |
| --- | --- |
| UNCHANGED | all firmware behaviour, all assets, the licence |
| CHANGED | 1 file (comment header only) + 1 file rename |
| ADDED | documentation, build tooling, web flasher, pre-built binaries |
| **REMOVED** | **NONE** |

The firmware diff is **20 added comment lines and 0 removed lines**. After
stripping comments the two sketches are byte-identical.

---

## UNCHANGED

Nothing in this list was touched.

### Behaviour
- The 90-frame animation loop, frame-for-frame.
- Frame order: `epd_bitmap_allArray[]` still lists `epd_bitmap_00 … epd_bitmap_89`.
- `frame` increment-then-wrap logic (`frame++; if (frame >= 90) {frame = 0;}`),
  including the detail that the first drawn frame after boot is index 1.
- Timing: still no `delay()`, no `millis()` scheduling, no FPS cap. The frame
  rate remains bus-bound and identical.
- Startup: `setup()` is still just `u8g2.begin()`.
- Idle / blink / eye movement / mouth movement / expressions / random behaviour:
  all of these live inside the exported frame sequence, which is unmodified.
- Sleep, wake, buttons, audio: absent upstream, still absent. Nothing added.

### Data and assets
- All 90 `epd_bitmap_NN` arrays. The SHA-256 of every `0x…` data line in the
  sketch is identical between the two files.
- `RIVE_big_smile_animation.riv`, both preview GIFs, both Photopea files, and
  all 90 PNGs of `RIVE_animation_export_png_sequence/`.
- No fonts are used by either sketch (`drawXBMP` only), so there is nothing to
  change there.

### Hardware and configuration
- `U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);` — identical.
- Resolution 128 × 64, draw call `drawXBMP(0, 0, 128, 64, …)` — identical
  coordinates and size.
- I²C: still hardware `Wire` with the XIAO_ESP32S3 variant defaults
  (SDA = GPIO 5, SCL = GPIO 6), address `0x3C`, 400 kHz.
- SPI: not used by either sketch.
- GPIO: neither sketch names a GPIO number.
- Board: `esp32:esp32:XIAO_ESP32S3`, every Tools-menu option left at its
  Arduino IDE default — including `PSRAM = Disabled`, `FlashSize = 8MB`,
  `PartitionScheme = default_8MB`, `CPUFreq = 240MHz`.
- Flash mode/frequency (`dio` / 80 MHz) and the partition table are the stock
  ones for this board.

### Libraries
- `Arduino.h`, `U8g2lib.h`, `Wire.h`. Same three includes, same order, no
  library added, removed or swapped.

### Licence
- [`LICENSE`](../LICENSE) at the repository root is **byte-identical** to the
  upstream `LICENSE`: MIT, `Copyright (c) 2025 upir`.
- The upstream copy is also kept at
  `original/esp32s3_oled_dasai_mochi/LICENSE`.

---

## CHANGED

### 1. `firmware/WolffBot/WolffBot.ino`

Renamed from `ARDUINO_xiao_oled_dasai_mochi/ARDUINO_xiao_oled_dasai_mochi.ino`.

**Reason for the rename:** the Arduino toolchain derives the firmware's file
names from the sketch folder, so the build now produces `WolffBot.ino.bin`,
`WolffBot.ino.bootloader.bin` and so on. Nothing in the source refers to the
sketch by name, so the rename cannot affect compilation or run time.

**Reason for the edit:** the fork has to identify itself and carry its
attribution.

The only edit is a 20-line comment block prepended to the file:

```
// WolffBot - OLED robot face firmware for Seeed XIAO ESP32S3 + SSD1306 …
// WolffBot is a modified fork of DASAI Mochi by upiir.
// Upstream project: https://github.com/upiir/esp32s3_oled_dasai_mochi
// Forked from upstream commit 71ecb80e… (2025-03-25)
// Original work Copyright (c) 2025 upir - released under the MIT License.
// …
// Original upstream header, kept verbatim for attribution:
```

The upstream header — including `created by upir, 2025`, the YouTube channel,
the source-files link, the Wokwi link and every product link — follows it
unchanged. Zero upstream lines were deleted or reworded.

**Verification.** With comments and blank lines stripped, the two files are
byte-identical; every added line starts with `//` or is blank; the ELF section
sizes of the two builds match for every loadable section (`.text`, `.rodata`,
`.data`, `.bss`, `.flash.*`) — only the DWARF debug sections differ, and only
because the source file's path is a different length.

### 2. `README.md`

The repository README now describes WolffBot. It states in its first line that
WolffBot is a modified fork of DASAI Mochi by upiir, links the upstream project,
and reproduces the MIT attribution. The upstream README is preserved unchanged
at `original/esp32s3_oled_dasai_mochi/README.md`.

### Deliberately NOT changed

- **No serial branding was added.** Printing a "WolffBot" banner would require
  `Serial.begin()`, which adds start-up time and a USB-CDC dependency the
  original does not have. Rule 1 (do not change behaviour) outranks the
  cosmetic win, so the firmware still produces no serial output at all.
- The identifiers `epd_bitmap_*`, `epd_bitmap_allArray`, `frame`, `u8g2` were
  left alone. Renaming them would gain nothing and risk breaking the build.
- The upstream folder `ARDUINO_xiao_oled_dasai_mochi/` still exists under
  `original/` with its original name.

---

## ADDED

Nothing here changes firmware behaviour; it is all tooling, documentation and
build output.

| Path | What it is |
| --- | --- |
| `original/esp32s3_oled_dasai_mochi/` | Verbatim snapshot of the upstream repository at the forked commit — sketch, assets, README and LICENSE |
| `original/UPSTREAM.md` | Which commit was forked and how to restore or re-diff it |
| `firmware/WolffBot/WolffBot.ino` | The fork's sketch (see CHANGED) |
| `docs/ORIGINAL_MOCHI_ARCHITECTURE.md` | Architecture of the original, read out of the sources |
| `docs/WOLFFBOT_CHANGES.md` | This file |
| `docs/HARDWARE.md` | Confirmed hardware configuration |
| `docs/BUILD.md` | How to build the firmware |
| `docs/FLASHING.md` | How to flash via the web flasher |
| `docs/WEB_FLASHER.md` | How the web flasher works and how to deploy it |
| `tools/build.sh` | Reproducible build with pinned core and library versions |
| `tools/make_manifest.py` | Emits `manifest.json` with offsets, sizes and hashes |
| `tools/compare_with_original.sh` | Automated WolffBot ↔ DASAI Mochi difference report |
| `web-flasher/` | Static Web Serial flasher (Vite + esptool-js) |
| `web-flasher/public/firmware/*.bin` | Pre-built binaries produced by `tools/build.sh` |
| `.github/workflows/pages.yml` | Builds the flasher and publishes it to GitHub Pages |
| `.gitignore` | Excludes local Arduino build output |

### Not added, on purpose

No AI, LLM, XiaoZhi, MCP, cloud API, speech recognition, TTS, wake word,
Wi-Fi, Bluetooth, camera, microphone, speaker, server or internet dependency —
and no placeholder architecture for any of them. The firmware has exactly the
capabilities the original had.

---

## REMOVED

**NONE.**

No upstream file, asset, library, licence line, attribution line or line of
code was deleted.
