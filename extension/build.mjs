import * as esbuild from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const watch = process.argv.includes("--watch");
const outdir = "dist";

async function copyStatic() {
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  await cp("manifest.json", path.join(outdir, "manifest.json"));
  await cp("icons", path.join(outdir, "icons"), { recursive: true });
  await mkdir(path.join(outdir, "popup"), { recursive: true });
  await cp("src/popup/popup.html", path.join(outdir, "popup/popup.html"));
  await cp("src/popup/popup.css", path.join(outdir, "popup/popup.css"));
  await mkdir(path.join(outdir, "options"), { recursive: true });
  await cp("src/options/options.html", path.join(outdir, "options/options.html"));
  await cp("src/options/options.css", path.join(outdir, "options/options.css"));
}

const sharedOptions = {
  bundle: true,
  outdir,
  target: "chrome110",
  sourcemap: true,
  logLevel: "info",
};

// The service worker is loaded with "type": "module" in the manifest, so it
// can use ESM import/export directly.
const backgroundBuild = {
  ...sharedOptions,
  entryPoints: { "background/service-worker": "src/background/service-worker.ts" },
  format: "esm",
};

// Content scripts and extension pages are loaded as classic scripts.
const classicBuild = {
  ...sharedOptions,
  entryPoints: {
    "content-scripts/content": "src/content-scripts/index.ts",
    "popup/popup": "src/popup/popup.ts",
    "options/options": "src/options/options.ts",
  },
  format: "iife",
};

await copyStatic();

if (watch) {
  const [bgCtx, classicCtx] = await Promise.all([
    esbuild.context(backgroundBuild),
    esbuild.context(classicBuild),
  ]);
  await Promise.all([bgCtx.watch(), classicCtx.watch()]);
  console.log("Watching for changes...");
} else {
  await Promise.all([esbuild.build(backgroundBuild), esbuild.build(classicBuild)]);
  console.log("Build complete.");
}
