# WolffBot

**A modified fork of [DASAI Mochi](https://github.com/upiir/esp32s3_oled_dasai_mochi) by [upiir](https://www.youtube.com/upir_upir).**

WolffBot is an OLED robot-face firmware for the Seeed Studio XIAO ESP32S3, plus
a browser-based installer that flashes it over USB with no toolchain to set up.

The firmware itself is DASAI Mochi. Not "inspired by" — the actual sketch, with
a comment header added and nothing else touched. Everything new in this
repository is around the firmware: documentation, a reproducible build, a
comparison tool, and the web flasher.

---

## What is preserved from DASAI Mochi

Everything. The firmware diff against upstream is **20 added comment lines and
0 removed lines**; with comments stripped, the two sketches are byte-identical.

- All 90 animation frames, bit for bit (the bitmap payload hashes match).
- The frame loop, frame order and wrap logic.
- Timing — still no `delay()`, no scheduler, no FPS cap. Same frame rate.
- Display driver, resolution, coordinates, rotation, I²C address and bus clock.
- GPIO: unchanged, because the sketch names none.
- Libraries: `Arduino.h`, `U8g2lib.h`, `Wire.h` — none added, removed or swapped.
- Board configuration: `esp32:esp32:XIAO_ESP32S3` with every Tools-menu option
  at its Arduino IDE default, PSRAM included (disabled).
- Rive sources, PNG frame exports, Photopea artwork, the upstream README and the
  MIT `LICENSE`, all kept under [`original/`](original/).

Nothing was removed. Verify it yourself:

```bash
tools/compare_with_original.sh
```

**No AI, no LLM, no XiaoZhi, no voice assistant, no Wi-Fi, no cloud, no
placeholders for any of them.** WolffBot at this stage does exactly what Mochi
does.

## Hardware

| | |
| --- | --- |
| Board | Seeed Studio XIAO ESP32S3 (`esp32:esp32:XIAO_ESP32S3`) |
| MCU | ESP32-S3 @ 240 MHz, 8 MB flash, PSRAM not enabled |
| Display | SSD1306 128 × 64 monochrome OLED, I²C, address `0x3C`, 400 kHz |
| SDA | GPIO 5 (silkscreen `D4`) |
| SCL | GPIO 6 (silkscreen `D5`) |

```
XIAO ESP32S3            SSD1306 128x64 OLED
  3V3  ───────────────► VCC
  GND  ───────────────► GND
  D4 (GPIO5, SDA) ────► SDA
  D5 (GPIO6, SCL) ────► SCL
```

Full details, and where each value was confirmed from, in
[docs/HARDWARE.md](docs/HARDWARE.md).

## Flashing

Plug the board in, open the web flasher in Chrome or Edge on a computer, click
**Подключить устройство**, pick the port, click **ПРОШИТЬ**. That is the whole
procedure — no Arduino IDE, no Python, no ESP-IDF, no PlatformIO, no Node.js, no
terminal.

Step-by-step instructions and the troubleshooting table:
[docs/FLASHING.md](docs/FLASHING.md).

> Web Serial does not work on Android, iOS, Safari or Firefox. Use Chrome or
> Edge on a computer.

## Web Flasher

A static page — no backend, no database — built with
[esptool-js](https://github.com/espressif/esptool-js) and the Web Serial API.
It detects the chip, revision, MAC and flash size before writing, refuses a
non-ESP32-S3 chip unless you explicitly confirm, shows real progress, and
verifies every written image by MD5 against the flash contents.

It never compiles or modifies firmware. It writes the pre-built binaries in
`web-flasher/public/firmware/` byte-for-byte at the offsets recorded in
`manifest.json`.

```bash
cd web-flasher
npm install
npm run build      # -> dist/, deploy anywhere static
npm run preview    # local check on http://localhost:4173
```

Design, error handling and deployment: [docs/WEB_FLASHER.md](docs/WEB_FLASHER.md).

### Deploying to GitHub Pages

`.github/workflows/pages.yml` builds and publishes the flasher on every push to
the default branch. Enable it once under **Settings → Pages → Build and
deployment → Source: GitHub Actions**. The site then lives at
`https://<your-user>.github.io/WolffBot-firmware/`.

## Building the firmware

```bash
tools/build.sh
```

Pinned to `esp32:esp32@3.3.9` and `U8g2@2.37.1`. Arduino IDE works too — open
`firmware/WolffBot/WolffBot.ino`, select **XIAO_ESP32S3**, leave every Tools
menu at its default. See [docs/BUILD.md](docs/BUILD.md).

Flash offsets (taken from the core's own `build/flash_args`, never hand-written):

```
0x0      WolffBot-bootloader.bin
0x8000   WolffBot-partitions.bin
0xe000   boot_app0.bin
0x10000  WolffBot-app.bin
```

A single-file `WolffBot-factory.bin` for offset `0x0` is produced as well.

## Repository layout

```
firmware/WolffBot/WolffBot.ino   the firmware (DASAI Mochi + a comment header)
original/                        verbatim snapshot of upstream at the forked commit
docs/                            architecture, changes, hardware, build, flashing
tools/                           build, manifest and comparison scripts
web-flasher/                     the static browser installer
```

## Documentation

| Document | What it covers |
| --- | --- |
| [ORIGINAL_MOCHI_ARCHITECTURE.md](docs/ORIGINAL_MOCHI_ARCHITECTURE.md) | How the original works, read out of its sources |
| [WOLFFBOT_CHANGES.md](docs/WOLFFBOT_CHANGES.md) | Every change, as UNCHANGED / CHANGED / ADDED / REMOVED |
| [HARDWARE.md](docs/HARDWARE.md) | Confirmed hardware configuration, with sources |
| [BUILD.md](docs/BUILD.md) | Building the firmware |
| [FLASHING.md](docs/FLASHING.md) | Flashing via the web flasher (Russian) |
| [WEB_FLASHER.md](docs/WEB_FLASHER.md) | How the flasher works and how to deploy it |

## Original project

- **Repository:** https://github.com/upiir/esp32s3_oled_dasai_mochi
- **Author:** upiir — https://www.youtube.com/upir_upir
- **Video:** https://youtu.be/QOoszpg0BsM
- **Wokwi sketch:** https://wokwi.com/projects/426385808890236929
- **Forked at commit:** `71ecb80e27af6f94aa453fe98e25a8bb557a7f18` (2025-03-25)

If you like this project, support the original author: he made the animation,
the artwork and the firmware. WolffBot only repackages his work.

## Licence

MIT.

```
Original work Copyright (c) 2025 upir
```

[`LICENSE`](LICENSE) is byte-identical to the upstream MIT licence and must stay
that way. Modifications made for WolffBot are released under the same licence.
Attribution to upiir is kept in the licence, in the sketch header, in the web
flasher's footer and in this README.

See also [`NOTICE`](NOTICE).
