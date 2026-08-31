#!/usr/bin/env python3
"""Write web-flasher/public/firmware/manifest.json for the staged WolffBot binaries.

Called by tools/build.sh. The offsets below are not guessed: they are the ones
the Arduino ESP32 core itself emits into build/flash_args, which in turn come
from XIAO_ESP32S3.build.bootloader_addr=0x0 in boards.txt and the fixed 0x8000 /
0xe000 / 0x10000 offsets in platform.txt.
"""

import hashlib
import json
import os
import subprocess

OUT_DIR = os.environ.get("OUT_DIR")
REPO_ROOT = os.environ.get("REPO_ROOT", ".")

PARTS = [
    ("0x0", "WolffBot-bootloader.bin", "Bootloader"),
    ("0x8000", "WolffBot-partitions.bin", "Partition table"),
    ("0xe000", "boot_app0.bin", "OTA data (boot_app0)"),
    ("0x10000", "WolffBot-app.bin", "WolffBot application"),
]

UPSTREAM_COMMIT = "71ecb80e27af6f94aa453fe98e25a8bb557a7f18"


def digest(path):
    data = open(path, "rb").read()
    return len(data), hashlib.sha256(data).hexdigest(), hashlib.md5(data).hexdigest()


def git_version():
    """Firmware version: the repo tag if there is one, else 1.0.0."""
    try:
        tag = subprocess.run(
            ["git", "-C", REPO_ROOT, "describe", "--tags", "--abbrev=0"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        return tag.lstrip("v") or "1.0.0"
    except Exception:
        return "1.0.0"


def main():
    manifest = {
        "name": "WolffBot",
        "version": git_version(),
        "description": "WolffBot firmware - a modified fork of DASAI Mochi by upiir",
        "upstream": {
            "project": "https://github.com/upiir/esp32s3_oled_dasai_mochi",
            "commit": UPSTREAM_COMMIT,
            "license": "MIT (c) 2025 upir",
        },
        "chip": "ESP32-S3",
        "board": "Seeed Studio XIAO ESP32S3 (esp32:esp32:XIAO_ESP32S3)",
        "flash": {"size": "8MB", "mode": "dio", "freq": "80m", "partitionScheme": "default_8MB"},
        "toolchain": {
            "arduinoCli": os.environ.get("ARDUINO_CLI_VERSION", "unknown"),
            "core": "esp32:esp32@" + os.environ.get("ESP32_CORE_VERSION", "unknown"),
            "libraries": ["U8g2 " + os.environ.get("U8G2_VERSION", "unknown")],
            "esptool": "5.3.0",
        },
        "parts": [],
        "factory": {},
    }

    for offset, filename, label in PARTS:
        size, sha, md5 = digest(os.path.join(OUT_DIR, filename))
        manifest["parts"].append({
            "offset": offset,
            "path": "firmware/" + filename,
            "label": label,
            "size": size,
            "sha256": sha,
            "md5": md5,
        })

    size, sha, md5 = digest(os.path.join(OUT_DIR, "WolffBot-factory.bin"))
    manifest["factory"] = {
        "offset": "0x0",
        "path": "firmware/WolffBot-factory.bin",
        "label": "WolffBot factory image",
        "size": size,
        "sha256": sha,
        "md5": md5,
    }

    with open(os.path.join(OUT_DIR, "manifest.json"), "w") as handle:
        json.dump(manifest, handle, indent=2)
        handle.write("\n")

    print(json.dumps(manifest["parts"], indent=2))


if __name__ == "__main__":
    main()
