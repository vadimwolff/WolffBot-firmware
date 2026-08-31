# Original DASAI Mochi — architecture

Everything in this document was read out of the upstream sources, the Arduino
ESP32 core and the U8g2 library. Nothing here is inferred from the project's
README or from the video; where a value comes from outside the code it is
labelled as such.

- **Upstream project:** https://github.com/upiir/esp32s3_oled_dasai_mochi
- **Upstream commit analysed:** `71ecb80e27af6f94aa453fe98e25a8bb557a7f18` (2025-03-25)
- **Licence:** MIT, © 2025 upir
- **Pristine copy in this repo:** [`original/esp32s3_oled_dasai_mochi/`](../original/esp32s3_oled_dasai_mochi/)

---

## 1. Repository layout

```
esp32s3_oled_dasai_mochi/
├── ARDUINO_xiao_oled_dasai_mochi/
│   └── ARDUINO_xiao_oled_dasai_mochi.ino     6192 lines, 575 197 bytes — the entire firmware
├── LICENSE                                   MIT, © 2025 upir
├── README.md                                 build notes and video links
├── PHOTOPEA_big_smile.png / .psd             source artwork
├── RIVE_big_smile_animation.riv              Rive animation source
├── RIVE_big_smile_animation.gif              rendered preview
├── RIVE_big_smile_animation_4x.gif           rendered preview, 4× scale
└── RIVE_animation_export_png_sequence/       00.png … 89.png — 90 exported frames
```

There is **no** PlatformIO configuration, no `library.properties`, no build
script, no partition CSV and no separate `.h` / `.cpp` / `.c` files. The whole
project is one Arduino sketch plus the design assets used to author the frames.

## 2. Target hardware

| Item | Value | Source |
| --- | --- | --- |
| Board | Seeed Studio XIAO ESP32S3 | sketch header + upstream README |
| Arduino FQBN | `esp32:esp32:XIAO_ESP32S3` | Arduino ESP32 core `boards.txt` |
| MCU | ESP32-S3, Xtensa LX7 | `XIAO_ESP32S3.build.mcu=esp32s3` |
| CPU clock | 240 MHz | `XIAO_ESP32S3.build.f_cpu=240000000L` |
| Flash size | 8 MB | `XIAO_ESP32S3.build.flash_size=8MB` |
| Flash mode | `dio` (menu label "QIO 80MHz") | `XIAO_ESP32S3.menu.FlashMode.qio.build.flash_mode=dio` |
| Flash frequency | 80 MHz | `XIAO_ESP32S3.build.flash_freq=80m` |
| Display | SSD1306, 128 × 64 px, monochrome | sketch constructor |
| Display bus | hardware I²C | sketch constructor (`_HW_I2C`) |
| I²C SDA | GPIO 5 (silkscreen `D4`) | core variant `XIAO_ESP32S3/pins_arduino.h` |
| I²C SCL | GPIO 6 (silkscreen `D5`) | core variant `XIAO_ESP32S3/pins_arduino.h` |
| I²C address | `0x3C` 7-bit (`0x78` 8-bit) | U8g2 `u8x8_cad.c`, SSD1306 default |
| I²C bus clock | 400 kHz | U8g2 `i2c_bus_clock_100kHz = 4` for this panel |

> The upstream README's title says "128x32px", but the sketch instantiates a
> **128 × 64** driver and draws 128 × 64 bitmaps. The code is authoritative:
> the display is 128 × 64.

### GPIO usage

The sketch contains **no** `pinMode`, `digitalRead`, `digitalWrite`,
`analogRead` or `attachInterrupt` call, and never names a GPIO number. The only
pins it touches are SDA/SCL, and only indirectly: `u8g2.begin()` calls
`Wire.begin()` with no arguments, so `Wire` uses the variant defaults above.

There are **no buttons, no sensors, no LEDs and no audio** in the firmware.

## 3. Libraries

| Library | Where it comes from | Why |
| --- | --- | --- |
| `Arduino.h` | ESP32 Arduino core | base runtime |
| `U8g2lib.h` | U8g2 by olikraus | SSD1306 driver and framebuffer |
| `Wire.h` | ESP32 Arduino core | I²C transport used by U8g2 |

`SPI` is pulled in transitively by U8g2 but no SPI device is used.

## 4. Display initialisation

```cpp
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);
```

- `SSD1306_128X64_NONAME` — generic SSD1306 128 × 64 panel.
- `F` — **full** framebuffer: U8g2 allocates 128 × 64 / 8 = **1024 bytes** of RAM
  and pushes the whole buffer per frame.
- `HW_I2C` — the Arduino `Wire` peripheral, not bit-banged I²C.
- `U8G2_R0` — no rotation.
- `U8X8_PIN_NONE` — the panel's reset line is not driven by the MCU.

`setup()` is a single call:

```cpp
void setup(void) {
  u8g2.begin();
}
```

## 5. Animation pipeline

The animation was authored in Rive, exported as a 90-frame PNG sequence
(`RIVE_animation_export_png_sequence/00.png … 89.png`) and converted to XBM-style
C arrays with [image2cpp](https://javl.github.io/image2cpp/). Each frame is one
`const unsigned char epd_bitmap_NN[] PROGMEM` array of 1024 bytes
(128 × 64 / 8), and all 90 are collected in a lookup table:

```cpp
const int epd_bitmap_allArray_LEN = 90;
const unsigned char* epd_bitmap_allArray[90] = { epd_bitmap_00, … epd_bitmap_89 };
```

Total frame data: **93 600 bytes** (per the upstream comment; 90 × 1024 = 92 160
bytes of pixel data plus array overhead).

Note that the array **initialisers** in the file are not in numeric order
(`epd_bitmap_22` is declared before `epd_bitmap_21`, and so on), but
`epd_bitmap_allArray[]` lists them strictly `00 … 89`. Playback order is
therefore numeric regardless of declaration order.

## 6. State machine and timing

There is no state machine. The complete run-time behaviour is:

```cpp
int frame;                       // zero-initialised global

void loop(void) {
  frame++;
  if (frame >= 90) { frame = 0; }

  u8g2.clearBuffer();
  u8g2.drawXBMP(0, 0, 128, 64, epd_bitmap_allArray[frame]);
  u8g2.sendBuffer();
}
```

Consequences that matter when preserving behaviour:

- **One animation, one loop.** No idle mode, no blink logic, no eye or mouth
  sub-animations, no random behaviour, no expressions selector — the 90 frames
  *are* all of that, baked into the exported sequence.
- **No startup animation** separate from the loop. `setup()` only initialises
  the display; the first thing drawn is frame 1.
- **No sleep, no wake, no button handling, no power management.**
- **No `delay()`, no `millis()` scheduling, no FPS cap.** The frame rate is
  whatever the I²C bus and CPU deliver.
- `frame` is a plain `int`; it is incremented *before* the bounds check, so the
  very first drawn frame is index 1, and index 0 is drawn once per wrap.

### Frame-rate arithmetic (calculated, not measured)

Each frame pushes 1024 bytes of framebuffer plus a small amount of command and
addressing overhead over a 400 kHz I²C bus. At 9 bits per byte on the wire that
is roughly 1024 × 9 / 400 000 ≈ **23 ms**, i.e. an upper bound near **40 fps**,
so the 90-frame loop takes on the order of **2.3 s**. This is an estimate from
the bus parameters — the firmware itself specifies no timing at all, and the
real rate has not been measured on hardware.

## 7. Memory

| Figure | Value | Source |
| --- | --- | --- |
| Program storage used | 408 711 bytes (12 %) | `arduino-cli compile` |
| Program storage available | 3 342 336 bytes | `default_8MB` partition scheme |
| Global (static) RAM | 24 716 bytes (7 %) | `arduino-cli compile` |
| RAM available for locals | 302 964 bytes | `arduino-cli compile` |
| U8g2 framebuffer | 1024 bytes, inside the figure above | full-buffer `_F_` constructor |
| Frame bitmaps | 93 600 bytes, in flash (`PROGMEM`) | upstream comment + array sizes |
| PSRAM | **not used**; menu default is `PSRAM = Disabled` | `boards.txt` menu order |

The sketch performs no dynamic allocation of its own.

## 8. Flash layout

With the default `PartitionScheme = default_8MB` ("Default with spiffs
(3MB APP/1.5MB SPIFFS)"), `tools/partitions/default_8MB.csv` in the core is:

| Name | Type | SubType | Offset | Size |
| --- | --- | --- | --- | --- |
| `nvs` | data | nvs | `0x9000` | `0x5000` |
| `otadata` | data | ota | `0xe000` | `0x2000` |
| `app0` | app | ota_0 | `0x10000` | `0x330000` |
| `app1` | app | ota_1 | `0x340000` | `0x330000` |
| `spiffs` | data | spiffs | `0x670000` | `0x180000` |
| `coredump` | data | coredump | `0x7F0000` | `0x10000` |

The images written to flash and their offsets (from `platform.txt` and
`XIAO_ESP32S3.build.bootloader_addr=0x0`, and reproduced verbatim in the
`flash_args` file the core emits at build time):

| Offset | Image |
| --- | --- |
| `0x0` | second-stage bootloader |
| `0x8000` | partition table |
| `0xe000` | `boot_app0.bin` (OTA-data initialiser) |
| `0x10000` | application |

## 9. Build process

The upstream project ships no build files, so the build is the stock Arduino
one: open `ARDUINO_xiao_oled_dasai_mochi.ino` in the Arduino IDE, install the
ESP32 board package and the U8g2 library, select **XIAO_ESP32S3**, leave every
Tools menu at its default, and upload. The equivalent command line is:

```
arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3 ARDUINO_xiao_oled_dasai_mochi
```

The Arduino IDE defaults for this board, taken from the *first* option of each
menu in `boards.txt` (which is how the IDE picks a default):

| Menu | Default |
| --- | --- |
| JTAGAdapter | Disabled |
| PSRAM | **Disabled** |
| FlashMode | QIO 80MHz (image header `dio`, boot `qio`) |
| FlashSize | 8MB (64Mb) |
| LoopCore | Core 1 |
| EventsCore | Core 1 |
| USBMode | Hardware CDC and JTAG |
| CDCOnBoot | Enabled |
| MSCOnBoot | Disabled |
| DFUOnBoot | Disabled |
| UploadMode | UART0 / Hardware CDC |
| PartitionScheme | Default with spiffs (3MB APP/1.5MB SPIFFS) |
| CPUFreq | 240MHz (WiFi) |
| UploadSpeed | 921600 |
| DebugLevel | None |
| EraseFlash | Disabled |

## 10. Dependencies summary

- Arduino ESP32 core (`esp32:esp32`) — provides the ESP32-S3 toolchain,
  `Arduino.h`, `Wire`, the bootloader and the partition tables.
- U8g2 (olikraus) — SSD1306 driver, framebuffer, `drawXBMP`.
- Nothing else. No network stack, no filesystem, no audio, no RTOS task of the
  sketch's own.
