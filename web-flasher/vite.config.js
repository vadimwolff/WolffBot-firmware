import { defineConfig } from "vite";

// Relative base so the built site works from any static host and from any
// GitHub Pages sub-path (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Firmware binaries live in public/ and are copied verbatim; they must never
    // be inlined or transformed by the bundler.
    assetsInlineLimit: 0,
  },
});
