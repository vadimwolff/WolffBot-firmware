/*
 * WolffBot Web Flasher
 *
 * Writes the pre-built WolffBot firmware binaries to an ESP32-S3 over Web Serial
 * using esptool-js. The flasher never compiles or modifies firmware: it loads the
 * .bin files that were produced by the reproducible build (tools/build.sh) and
 * writes them byte-for-byte at the offsets recorded in firmware/manifest.json.
 *
 * WolffBot is a modified fork of DASAI Mochi by upiir (MIT, (c) 2025 upir).
 */

import { ESPLoader, Transport } from "esptool-js";
import { md5 } from "js-md5";
import "./style.css";

/* ------------------------------------------------------------------ */
/* DOM                                                                 */
/* ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);

const el = {
  unsupported: $("unsupported"),
  app: $("app"),
  device: $("v-device"),
  serial: $("v-serial"),
  flash: $("v-flash"),
  mac: $("v-mac"),
  firmware: $("v-firmware"),
  status: $("v-status"),
  btnConnect: $("btn-connect"),
  btnFlash: $("btn-flash"),
  btnDisconnect: $("btn-disconnect"),
  progressWrap: $("progress-wrap"),
  progressFill: $("progress-fill"),
  progressStep: $("progress-step"),
  progressPct: $("progress-pct"),
  chipWarning: $("chip-warning"),
  chipWarningText: $("chip-warning-text"),
  chkForce: $("chk-force"),
  chkErase: $("chk-erase"),
  selBaud: $("sel-baud"),
  error: $("error"),
  errorText: $("error-text"),
  errorHint: $("error-hint"),
  success: $("success"),
  log: $("log"),
  partsTable: $("parts-table").querySelector("tbody"),
  partsNote: $("parts-note"),
};

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** The chip this firmware was built for. */
const TARGET_CHIP = "ESP32-S3";

/**
 * USB IDs the WolffBot target board can enumerate with.
 * 0x2886/0x0056 and 0x2886/0x8056 come from the XIAO_ESP32S3 entry of the
 * Arduino ESP32 boards.txt; 0x303a/0x1001 is the Espressif USB-JTAG/serial
 * device exposed by an ESP32-S3 running in "Hardware CDC and JTAG" USB mode.
 */
const KNOWN_USB_IDS = {
  "2886:0056": "Seeed Studio XIAO ESP32S3",
  "2886:8056": "Seeed Studio XIAO ESP32S3 (bootloader)",
  "303a:1001": "ESP32-S3 USB-JTAG/serial",
  "303a:0002": "ESP32-S3 USB-OTG (TinyUSB)",
};

const BOOTLOADER_HINT =
  "Если устройство не отвечает: отключите USB-кабель, зажмите и удерживайте кнопку BOOT (B) на плате, " +
  "снова подключите USB, затем отпустите BOOT и попробуйте ещё раз. " +
  "Порядок действий для XIAO ESP32S3 описан в документации Seeed: " +
  "https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/";

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let manifest = null;
/** @type {Array<{offset:number,name:string,data:Uint8Array}>} */
let images = [];
let port = null;
let transport = null;
let loader = null;
let chipName = null;
let detectedFlashBytes = null;
let busy = false;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function log(line) {
  el.log.textContent += line.endsWith("\n") ? line : line + "\n";
  el.log.scrollTop = el.log.scrollHeight;
}

function setStatus(text) {
  el.status.textContent = text;
}

function setStep(text) {
  el.progressStep.textContent = text;
}

function setProgress(fraction) {
  const pct = Math.max(0, Math.min(100, Math.round(fraction * 100)));
  el.progressFill.style.width = pct + "%";
  el.progressPct.textContent = pct + "%";
}

function showError(message, hint = "") {
  el.errorText.textContent = message;
  el.errorHint.textContent = hint;
  el.error.hidden = false;
  el.success.hidden = true;
  log("ОШИБКА: " + message);
}

function clearError() {
  el.error.hidden = true;
  el.errorHint.textContent = "";
}

function formatBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(2) + " MB";
}

/** esptool-js terminal sink; also used to surface the verify phase in the UI. */
const terminal = {
  clean() {
    /* keep the full log, the UI has no separate console */
  },
  writeLine(data) {
    log(String(data));
    const s = String(data);
    if (s.includes("Flash md5") || s.includes("Hash of data verified")) {
      setStep("Проверка…");
    }
  },
  write(data) {
    el.log.textContent += String(data);
    el.log.scrollTop = el.log.scrollHeight;
  },
};

/* ------------------------------------------------------------------ */
/* Manifest + firmware loading                                         */
/* ------------------------------------------------------------------ */

async function loadManifest() {
  const url = new URL("./firmware/manifest.json", document.baseURI);
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`не удалось загрузить manifest.json (HTTP ${res.status})`);
  return res.json();
}

async function loadImages() {
  const out = [];
  for (const part of manifest.parts) {
    const url = new URL("./" + part.path, document.baseURI);
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`не удалось загрузить ${part.path} (HTTP ${res.status})`);
    const data = new Uint8Array(await res.arrayBuffer());
    if (data.length !== part.size) {
      throw new Error(
        `файл ${part.path} повреждён: ожидалось ${part.size} байт, получено ${data.length}`
      );
    }
    const actualMd5 = md5(data);
    if (actualMd5 !== part.md5) {
      throw new Error(`файл ${part.path} повреждён: MD5 не совпадает с manifest.json`);
    }
    out.push({ offset: parseInt(part.offset, 16), name: part.path.split("/").pop(), data });
  }
  return out;
}

function renderParts() {
  el.partsTable.innerHTML = "";
  for (const part of manifest.parts) {
    const tr = document.createElement("tr");
    for (const text of [part.offset, part.label, formatBytes(part.size)]) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    }
    el.partsTable.appendChild(tr);
  }
  el.partsNote.textContent =
    `Сборка: ${manifest.board}, ядро ${manifest.toolchain.core}, ` +
    `flash ${manifest.flash.size} ${manifest.flash.mode} ${manifest.flash.freq}, ` +
    `схема разделов ${manifest.flash.partitionScheme}. ` +
    `Также доступен единый образ ${manifest.factory.path.split("/").pop()} ` +
    `(${formatBytes(manifest.factory.size)}) для записи по адресу ${manifest.factory.offset}.`;
}

/* ------------------------------------------------------------------ */
/* Error translation                                                   */
/* ------------------------------------------------------------------ */

function describeError(err) {
  const raw = err && err.message ? err.message : String(err);
  const m = raw.toLowerCase();

  if (err && err.name === "NotFoundError") {
    return ["Выбор порта отменён.", "Нажмите «Подключить устройство» и выберите порт в списке."];
  }
  if (err && err.name === "SecurityError") {
    return [
      "Браузер запретил доступ к последовательному порту.",
      "Откройте сайт по HTTPS (или с localhost) и разрешите доступ к устройству.",
    ];
  }
  if (m.includes("already open") || m.includes("failed to open serial port") || m.includes("in use")) {
    return [
      "Порт занят другой программой.",
      "Закройте Arduino IDE, монитор порта, PlatformIO или другой терминал и попробуйте снова.",
    ];
  }
  if (m.includes("device has been lost") || m.includes("the device has been lost") || m.includes("break condition")) {
    return ["Связь с устройством потеряна.", "Проверьте USB-кабель и переподключите устройство."];
  }
  if (m.includes("failed to connect") || m.includes("no serial data received") || m.includes("wrong boot mode")) {
    return ["ESP32 не отвечает и не вошёл в режим загрузчика.", BOOTLOADER_HINT];
  }
  if (m.includes("timeout") || m.includes("timed out")) {
    return [
      "Истекло время ожидания ответа от устройства.",
      "Попробуйте меньшую скорость порта (115200) в настройках прошивки. " + BOOTLOADER_HINT,
    ];
  }
  if (m.includes("md5")) {
    return [
      "Проверка записанных данных не прошла: содержимое flash не совпадает с прошивкой.",
      "Повторите прошивку. Если ошибка повторяется — попробуйте меньшую скорость порта или другой USB-кабель.",
    ];
  }
  if (m.includes("doesn't fit") || m.includes("does not fit")) {
    return [
      "На устройстве недостаточно места во flash для этой прошивки.",
      "WolffBot собран для платы с 8 МБ flash.",
    ];
  }
  if (m.includes("erase")) {
    return ["Не удалось стереть flash.", "Повторите попытку. " + BOOTLOADER_HINT];
  }
  if (m.includes("unsupported") || m.includes("unknown chip") || m.includes("chip magic")) {
    return [
      "Не удалось определить тип чипа.",
      "Убедитесь, что подключена плата на ESP32-S3, и что выбран правильный порт.",
    ];
  }
  if (m.includes("manifest") || m.includes("повреждён") || m.includes("не удалось загрузить")) {
    return ["Не удалось загрузить файлы прошивки.", "Обновите страницу. Если не помогает — файлы прошивки на сайте повреждены."];
  }
  return ["Прошивка не завершена: " + raw, "Подробности — в журнале ниже."];
}

/* ------------------------------------------------------------------ */
/* Connect / disconnect                                                */
/* ------------------------------------------------------------------ */

function usbLabel(info) {
  if (!info || info.usbVendorId === undefined || info.usbProductId === undefined) {
    return "порт выбран (USB ID недоступен)";
  }
  const vid = info.usbVendorId.toString(16).padStart(4, "0");
  const pid = info.usbProductId.toString(16).padStart(4, "0");
  const key = `${vid}:${pid}`;
  const known = KNOWN_USB_IDS[key];
  return known ? `USB ${key} — ${known}` : `USB ${key}`;
}

async function connect() {
  if (busy) return;
  busy = true;
  clearError();
  el.success.hidden = true;
  el.btnConnect.disabled = true;

  try {
    setStatus("Запрос порта…");
    port = await navigator.serial.requestPort();

    el.serial.textContent = usbLabel(port.getInfo ? port.getInfo() : null);

    setStatus("Подключение к ESP32…");
    el.progressWrap.hidden = false;
    setStep("Подключение к ESP32…");
    setProgress(0);

    const baud = parseInt(el.selBaud.value, 10);
    transport = new Transport(port, false);
    loader = new ESPLoader({ transport, baudrate: baud, terminal });

    setStep("Определение чипа…");
    const description = await loader.main();
    chipName = loader.chip && loader.chip.CHIP_NAME ? loader.chip.CHIP_NAME : String(description);

    el.device.textContent = description || chipName;

    // MAC and flash size are informational; never block flashing on them.
    try {
      el.mac.textContent = await loader.chip.readMac(loader);
    } catch {
      el.mac.textContent = "не определён";
    }
    try {
      const size = await loader.detectFlashSize();
      if (size) {
        el.flash.textContent = size;
        detectedFlashBytes = loader.flashSizeBytes(size) || null;
      } else {
        el.flash.textContent = "не определён";
      }
    } catch {
      el.flash.textContent = "не определён";
    }

    const isTarget = String(chipName).toUpperCase().startsWith(TARGET_CHIP);
    if (!isTarget) {
      el.chipWarningText.textContent = `Подключено устройство: ${description || chipName}.`;
      el.chipWarning.hidden = false;
      el.chkForce.checked = false;
      setStatus("Подключено — чип не ESP32-S3");
    } else {
      el.chipWarning.hidden = true;
      setStatus("Подключено");
    }

    el.btnFlash.hidden = false;
    el.btnDisconnect.hidden = false;
    el.btnConnect.hidden = true;
    el.progressWrap.hidden = true;
    setStep("Готово к прошивке");
  } catch (err) {
    const [message, hint] = describeError(err);
    showError(message, hint);
    setStatus("Не подключено");
    el.progressWrap.hidden = true;
    await hardCleanup();
  } finally {
    el.btnConnect.disabled = false;
    busy = false;
  }
}

async function hardCleanup() {
  try {
    if (transport) await transport.disconnect();
  } catch {
    /* the port may already be gone; nothing useful to do */
  }
  transport = null;
  loader = null;
  port = null;
  chipName = null;
  detectedFlashBytes = null;
}

async function disconnect() {
  if (busy) return;
  busy = true;
  await hardCleanup();
  el.btnConnect.hidden = false;
  el.btnFlash.hidden = true;
  el.btnDisconnect.hidden = true;
  el.chipWarning.hidden = true;
  el.progressWrap.hidden = true;
  el.device.textContent = "—";
  el.serial.textContent = "—";
  el.flash.textContent = "—";
  el.mac.textContent = "—";
  setStatus("Не подключено");
  busy = false;
}

/* ------------------------------------------------------------------ */
/* Flash                                                               */
/* ------------------------------------------------------------------ */

async function flash() {
  if (busy || !loader) return;

  const isTarget = String(chipName).toUpperCase().startsWith(TARGET_CHIP);
  if (!isTarget && !el.chkForce.checked) {
    showError(
      "Прошивка остановлена: подключённый чип не ESP32-S3.",
      "Отметьте галочку подтверждения в блоке предупреждения, если вы всё равно хотите продолжить."
    );
    return;
  }

  busy = true;
  clearError();
  el.success.hidden = true;
  el.btnFlash.disabled = true;
  el.btnDisconnect.disabled = true;
  el.progressWrap.hidden = false;
  setProgress(0);

  try {
    setStep("Подготовка…");
    setStatus("Прошивка…");
    if (images.length === 0) images = await loadImages();

    const totalBytes = images.reduce((sum, img) => sum + img.data.length, 0);
    const highestEnd = images.reduce((max, img) => Math.max(max, img.offset + img.data.length), 0);
    if (detectedFlashBytes && highestEnd > detectedFlashBytes) {
      throw new Error("Firmware doesn't fit in the available flash");
    }

    const eraseAll = el.chkErase.checked;
    if (eraseAll) setStep("Стирание flash…");

    // Byte offsets before each image, used to turn per-file progress into
    // overall progress across all four images.
    const written = new Array(images.length).fill(0);

    setStep(eraseAll ? "Стирание flash…" : "Запись firmware…");

    await loader.writeFlash({
      fileArray: images.map((img) => ({ data: img.data, address: img.offset })),
      // "keep" reproduces exactly what the Arduino IDE upload does: the flash
      // mode/frequency/size already encoded in the built bootloader image
      // (dio / 80m / 8MB) are preserved and not rewritten by the flasher.
      flashMode: "keep",
      flashFreq: "keep",
      flashSize: "keep",
      eraseAll,
      compress: true,
      reportProgress: (fileIndex, done) => {
        written[fileIndex] = done;
        const sum = written.reduce((a, b) => a + b, 0);
        setProgress(sum / totalBytes);
        if (sum > 0) setStep("Запись firmware…");
      },
      calculateMD5Hash: (image) => md5(image),
    });

    setStep("Завершение…");
    setProgress(1);
    await loader.after("hard_reset");

    el.success.hidden = false;
    setStatus("Готово");
    setStep("Завершено");
    log("WolffBot записан успешно.");
  } catch (err) {
    const [message, hint] = describeError(err);
    showError(message, hint);
    setStatus("Ошибка прошивки");
    setStep("Прервано");
  } finally {
    el.btnFlash.disabled = false;
    el.btnDisconnect.disabled = false;
    busy = false;
  }
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

async function init() {
  if (!("serial" in navigator)) {
    el.unsupported.hidden = false;
    return;
  }
  el.app.hidden = false;

  try {
    manifest = await loadManifest();
  } catch (err) {
    const [message, hint] = describeError(err);
    showError(message, hint);
    el.btnConnect.disabled = true;
    return;
  }

  el.firmware.textContent = `${manifest.name} ${manifest.version}`;
  renderParts();
  log(`WolffBot ${manifest.version} — прошивка для ${manifest.chip} (${manifest.board}).`);
  log(`Собрано с ${manifest.toolchain.core}, arduino-cli ${manifest.toolchain.arduinoCli}.`);

  el.btnConnect.addEventListener("click", connect);
  el.btnFlash.addEventListener("click", flash);
  el.btnDisconnect.addEventListener("click", disconnect);

  navigator.serial.addEventListener("disconnect", (event) => {
    if (port && event.target === port) {
      log("USB-устройство отключено.");
      if (!busy) disconnect();
      else showError("Устройство отключено во время прошивки.", "Подключите USB и повторите прошивку с самого начала.");
    }
  });
}

init();
