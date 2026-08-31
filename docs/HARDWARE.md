# WolffBot — hardware configuration

This is the **confirmed** hardware configuration of the original DASAI Mochi
project, which WolffBot keeps unchanged. Every row states where the value comes
from. Values that are not stated in the code are marked as vendor documentation
rather than presented as facts from the source.

---

## Board

| Item | Value | Confirmed from |
| --- | --- | --- |
| Board | Seeed Studio XIAO ESP32S3 | upstream sketch header and README |
| Arduino FQBN | `esp32:esp32:XIAO_ESP32S3` | Arduino ESP32 core `boards.txt` |
| MCU | ESP32-S3 (Xtensa LX7, dual core) | `XIAO_ESP32S3.build.mcu=esp32s3` |
| CPU frequency | 240 MHz | `XIAO_ESP32S3.build.f_cpu=240000000L` |
| USB VID:PID | `2886:0056` (and `2886:8056`) | `XIAO_ESP32S3.vid.*` / `.pid.*` |
| Flash size | 8 MB | `XIAO_ESP32S3.build.flash_size=8MB` |
| Flash mode (image header) | `dio` | `XIAO_ESP32S3.menu.FlashMode.qio.build.flash_mode=dio` |
| Flash boot / memory type | `qio_qspi` | `build.boot=qio`, `build.psram_type=qspi` |
| Flash frequency | 80 MHz | `XIAO_ESP32S3.build.flash_freq=80m` |
| PSRAM | **not enabled by this firmware** | `boards.txt` menu default is `PSRAM = Disabled` |

> On PSRAM: the XIAO ESP32S3 module carries PSRAM according to Seeed's product
> documentation, and the Arduino board definition offers an `OPI PSRAM` menu
> option. The Arduino IDE default for this board is `Disabled`, the original
> sketch never allocates from PSRAM, and WolffBot keeps that default. The exact
> PSRAM size is a vendor-documentation figure, not something the firmware or the
> board definition asserts, so it is not quoted here.

## Display

| Item | Value | Confirmed from |
| --- | --- | --- |
| Controller | SSD1306 | sketch constructor |
| Resolution | 128 × 64 px, monochrome | sketch constructor and `drawXBMP(0, 0, 128, 64, …)` |
| Interface | I²C (hardware `Wire`) | `…_HW_I2C` in the constructor |
| U8g2 constructor | `U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE)` | sketch line 41 (upstream) |
| Buffer mode | full framebuffer, 1024 bytes of RAM | `_F_` variant of the constructor |
| Rotation | none (`U8G2_R0`) | sketch constructor |
| Reset pin | not driven (`U8X8_PIN_NONE`) | sketch constructor |
| I²C address | `0x3C` 7-bit / `0x78` 8-bit | U8g2 `u8x8_cad.c` SSD1306 default (`i2c_address = 0x078`) |
| I²C bus clock | 400 kHz | U8g2 `u8x8_d_ssd1306_128x64_noname.c`, `i2c_bus_clock_100kHz = 4` |

> The upstream README's *title* says "128x32px". The code says 128 × 64, draws
> 128 × 64 bitmaps, and the exported PNG frames are 128 × 64. The code wins.

## Wiring

The sketch calls `u8g2.begin()`, which reaches `Wire.begin()` with no arguments,
so I²C uses the XIAO_ESP32S3 variant defaults from
`variants/XIAO_ESP32S3/pins_arduino.h` in the Arduino ESP32 core:

| Signal | GPIO | XIAO silkscreen | Confirmed from |
| --- | --- | --- | --- |
| SDA | GPIO 5 | `D4` | `static const uint8_t SDA = 5;` and `static const uint8_t D4 = 5;` |
| SCL | GPIO 6 | `D5` | `static const uint8_t SCL = 6;` and `static const uint8_t D5 = 6;` |
| 3V3 | — | `3V3` | display power (board silkscreen) |
| GND | — | `GND` | display ground (board silkscreen) |

```
XIAO ESP32S3            SSD1306 128x64 OLED
  3V3  ───────────────► VCC
  GND  ───────────────► GND
  D4 (GPIO5, SDA) ────► SDA
  D5 (GPIO6, SCL) ────► SCL
```

### GPIO used by the firmware

**Only SDA and SCL, and only indirectly.** The sketch contains no `pinMode`,
`digitalWrite`, `digitalRead`, `analogRead`, `ledcWrite`, `attachInterrupt` or
touch call, and never writes a GPIO number.

The variant also defines `LED_BUILTIN = 21`, `TX = 43`, `RX = 44`,
`MOSI = 9`, `MISO = 8`, `SCK = 7`, `SS = 44` — none of which this firmware uses.

## Peripherals **not** used

- No buttons or other inputs.
- No SPI devices.
- No audio in or out (no I²S, no microphone, no speaker).
- No camera.
- No Wi-Fi, Bluetooth or any network stack.
- No filesystem (the SPIFFS partition exists in the partition table but is never
  mounted).
- No deep sleep, light sleep or any power management beyond the core defaults.

## Build-time configuration (Arduino IDE Tools menu)

Every option is left at the Arduino IDE default, which is the first entry of
each menu in `boards.txt`:

| Menu | Default used |
| --- | --- |
| JTAGAdapter | Disabled |
| PSRAM | Disabled |
| FlashMode | QIO 80MHz |
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

## Flash layout

Partition table `default_8MB` (`tools/partitions/default_8MB.csv` in the core):

| Name | Type | SubType | Offset | Size |
| --- | --- | --- | --- | --- |
| `nvs` | data | nvs | `0x9000` | `0x5000` |
| `otadata` | data | ota | `0xe000` | `0x2000` |
| `app0` | app | ota_0 | `0x10000` | `0x330000` |
| `app1` | app | ota_1 | `0x340000` | `0x330000` |
| `spiffs` | data | spiffs | `0x670000` | `0x180000` |
| `coredump` | data | coredump | `0x7F0000` | `0x10000` |

Images and their flash offsets — these come from
`XIAO_ESP32S3.build.bootloader_addr=0x0` in `boards.txt` plus the fixed offsets
in `platform.txt`, and the build reproduces them verbatim in `build/flash_args`:

| Offset | Image |
| --- | --- |
| `0x0` | `WolffBot-bootloader.bin` |
| `0x8000` | `WolffBot-partitions.bin` |
| `0xe000` | `boot_app0.bin` |
| `0x10000` | `WolffBot-app.bin` |

> `0x0`, not `0x1000`. `platform.txt` defaults to `0x1000`, but the
> XIAO_ESP32S3 board entry overrides it with `build.bootloader_addr=0x0`, which
> is correct for ESP32-S3.

## Measured build figures

From `arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3`:

| Figure | Value |
| --- | --- |
| Program storage used | 408 711 bytes (12 % of 3 342 336) |
| Global variables | 24 716 bytes (7 % of 327 680) |
| RAM left for locals | 302 964 bytes |

Identical for the upstream sketch and for WolffBot.
