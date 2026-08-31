# Building WolffBot firmware

WolffBot builds exactly the way the original DASAI Mochi sketch builds: it is a
plain Arduino sketch for the Seeed Studio XIAO ESP32S3, with every Tools-menu
option left at its default. Nothing about the original build was changed — the
scripts here only automate it and stage the output.

You do **not** need this document to flash a device. To just install WolffBot,
see [FLASHING.md](FLASHING.md) — the web flasher needs no toolchain at all.

---

## Pinned versions

| Component | Version | Why pinned |
| --- | --- | --- |
| Arduino ESP32 core | `esp32:esp32@3.3.9` | determines the bootloader, partition tables and flash offsets |
| U8g2 | `2.37.1` | the display driver; a different version changes the compiled image |
| arduino-cli | `1.3.1` | the version the shipped binaries were built with |
| esptool | `5.3.0` (bundled with the core) | produces the factory image |

These are set at the top of [`tools/build.sh`](../tools/build.sh). Change them
deliberately; they define the firmware.

> U8g2 note: the upstream `U8g2_Arduino` repository tags this release `2.37.1`
> while its `library.properties` still reads `2.36.19`. Both refer to the same
> code. `arduino-cli lib install U8g2@2.37.1` resolves it correctly.

---

## Option A — Arduino IDE (the original workflow, unchanged)

1. Install the **ESP32 by Espressif Systems** board package. In
   *File → Preferences → Additional boards manager URLs* add:
   ```
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```
   then install version **3.3.9** from *Tools → Board → Boards Manager*.
2. Install **U8g2** by oliver from *Tools → Manage Libraries* (version 2.37.1).
3. Open `firmware/WolffBot/WolffBot.ino`.
4. *Tools → Board → esp32 → **XIAO_ESP32S3***.
5. **Leave every other Tools menu at its default.** The defaults are listed in
   [HARDWARE.md](HARDWARE.md#build-time-configuration-arduino-ide-tools-menu);
   changing PSRAM, Partition Scheme, Flash Size or CPU Frequency changes the
   firmware and is not what WolffBot ships.
6. *Sketch → Export Compiled Binary* (or Upload, to flash directly).

The original sketch builds the same way from
`original/esp32s3_oled_dasai_mochi/ARDUINO_xiao_oled_dasai_mochi/`.

## Option B — `tools/build.sh` (reproducible, what ships)

Requires [`arduino-cli`](https://arduino.github.io/arduino-cli/) ≥ 1.0 and
`python3`.

```bash
tools/build.sh
```

The script:

1. installs `esp32:esp32@3.3.9` and `U8g2@2.37.1` if they are missing
   (`tools/build.sh --deps-only` stops after this step);
2. compiles `firmware/WolffBot` for `esp32:esp32:XIAO_ESP32S3` with **no**
   `--build-property` overrides, so all board defaults apply;
3. prints the core's own `build/flash_args`, which is where the flash offsets
   in this project come from — they are never hand-written;
4. copies the four images into `web-flasher/public/firmware/`;
5. merges them into a single `WolffBot-factory.bin` starting at `0x0`;
6. writes `web-flasher/public/firmware/manifest.json` with offsets, sizes,
   SHA-256 and MD5 for each image.

Set `ARDUINO_CLI=/path/to/arduino-cli` if it is not on `PATH`.

---

## Build output

`build/` after a successful compile:

| File | Size | Purpose |
| --- | --- | --- |
| `WolffBot.ino.bootloader.bin` | 19 984 B | second-stage bootloader |
| `WolffBot.ino.partitions.bin` | 3 072 B | partition table (`default_8MB`) |
| `boot_app0.bin` | 8 192 B | OTA-data initialiser, copied from the core |
| `WolffBot.ino.bin` | 408 864 B | the application |
| `WolffBot.ino.merged.bin` | 8 MB | the core's own merged image, padded to full flash |
| `WolffBot.ino.elf` | — | for `nm` / `objdump` / debugging |
| `flash_args` | — | the offsets, emitted by the core |

Staged into `web-flasher/public/firmware/` with WolffBot names, plus the
un-padded factory image:

| File | Size |
| --- | --- |
| `WolffBot-bootloader.bin` | 19 984 B |
| `WolffBot-partitions.bin` | 3 072 B |
| `boot_app0.bin` | 8 192 B |
| `WolffBot-app.bin` | 408 864 B |
| `WolffBot-factory.bin` | 474 400 B (`0x73D20`) |

`WolffBot-factory.bin` is the same four images merged at their real offsets but
**not** padded to 8 MB, so it is small enough to serve from a static site. It is
written at offset `0x0`.

## Flash offsets

```
0x0      WolffBot-bootloader.bin
0x8000   WolffBot-partitions.bin
0xe000   boot_app0.bin
0x10000  WolffBot-app.bin
```

flash mode `dio`, flash frequency `80m`, flash size `8MB`.

These are not guessed. They are what the Arduino ESP32 core writes into
`build/flash_args` and into its own upload command line, derived from
`XIAO_ESP32S3.build.bootloader_addr=0x0` in `boards.txt` and the fixed
`0x8000` / `0xe000` / `0x10000` offsets in `platform.txt`.

## Expected compiler output

```
Sketch uses 408711 bytes (12%) of program storage space. Maximum is 3342336 bytes.
Global variables use 24716 bytes (7%) of dynamic memory, leaving 302964 bytes
for local variables. Maximum is 327680 bytes.
```

The same numbers as the upstream sketch. Warnings from `--warnings all` come
only from the ESP32 core and its bundled TinyUSB headers; `WolffBot.ino` itself
compiles with **no** warnings.

## Verifying the fork against the original

```bash
tools/compare_with_original.sh
```

Checks that the sketch differs by comment lines only, that the bitmap payload
hashes match, that the display/I²C configuration is untouched, that all upstream
assets are present, that the MIT licence and attribution are intact, and that no
networking/audio/AI symbols were introduced. Exit status 0 means no functional
difference.

## Building the web flasher

```bash
cd web-flasher
npm install
npm run build      # -> web-flasher/dist/
npm run preview    # local check on http://localhost:4173
```

`npm run build` copies `public/firmware/` into `dist/firmware/` verbatim. Run
`tools/build.sh` first if you changed the firmware, otherwise the site will ship
stale binaries.

## Sandbox note

The binaries in this repository were built in an environment where
`downloads.arduino.cc` was unreachable, so the ESP32 package index was fetched
from its GitHub mirror
(`raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`,
the same file `espressif.github.io` serves) and U8g2 was installed from the
`olikraus/U8g2_Arduino` tag `2.37.1` instead of the Arduino library index. Both
deliver identical sources, and neither affects the compiled output. On a normal
machine `tools/build.sh` uses the standard `arduino-cli` paths and needs no
workaround.
