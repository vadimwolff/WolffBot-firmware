# Upstream snapshot

`esp32s3_oled_dasai_mochi/` in this directory is a **verbatim copy** of the
original DASAI Mochi repository at the commit WolffBot was forked from. It is
never modified. It exists so the fork can always be diffed against, and restored
to, the original.

| | |
| --- | --- |
| Project | DASAI Mochi (`esp32s3_oled_dasai_mochi`) |
| Author | upiir — https://www.youtube.com/upir_upir |
| Repository | https://github.com/upiir/esp32s3_oled_dasai_mochi |
| Commit | `71ecb80e27af6f94aa453fe98e25a8bb557a7f18` |
| Date | 2025-03-25 09:42:20 +0100 |
| Message | `Add files via upload` |
| Licence | MIT, © 2025 upir |

## Contents

```
esp32s3_oled_dasai_mochi/
├── ARDUINO_xiao_oled_dasai_mochi/
│   └── ARDUINO_xiao_oled_dasai_mochi.ino     the original firmware, untouched
├── LICENSE                                   MIT, © 2025 upir
├── README.md                                 the original README
├── PHOTOPEA_big_smile.png
├── PHOTOPEA_big_smile.psd
├── RIVE_big_smile_animation.riv              Rive animation source
├── RIVE_big_smile_animation.gif
├── RIVE_big_smile_animation_4x.gif
└── RIVE_animation_export_png_sequence/       00.png … 89.png (90 frames)
```

Total: ~1.1 MB. Everything upstream ships is here; nothing was dropped to save
space, and nothing is duplicated elsewhere in the repository.

## Comparing WolffBot against the original

```bash
tools/compare_with_original.sh
```

Reports source differences, and checks GPIO/display configuration, animation
data hashes, assets, libraries, the loop and timing, licence and attribution.
Exit status 0 means no functional difference.

Raw diff of the sketch:

```bash
diff original/esp32s3_oled_dasai_mochi/ARDUINO_xiao_oled_dasai_mochi/ARDUINO_xiao_oled_dasai_mochi.ino \
     firmware/WolffBot/WolffBot.ino
```

## Restoring the original firmware

Build and flash it straight from the snapshot — it is a complete, unmodified
Arduino sketch:

```bash
arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3 \
  original/esp32s3_oled_dasai_mochi/ARDUINO_xiao_oled_dasai_mochi
```

Or open `ARDUINO_xiao_oled_dasai_mochi.ino` in the Arduino IDE, select
**XIAO_ESP32S3**, leave every Tools menu at its default, and upload.

## Re-fetching upstream

```bash
git clone https://github.com/upiir/esp32s3_oled_dasai_mochi.git
cd esp32s3_oled_dasai_mochi
git checkout 71ecb80e27af6f94aa453fe98e25a8bb557a7f18
```

The result should match this directory exactly (apart from `.git/`).
