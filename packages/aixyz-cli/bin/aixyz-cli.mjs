#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const entry = resolve(__dirname, "..", "dist", "bin.js");

/**
 * This script will be the entry point for the CLI when published. It ensures that the CLI is executed with Bun, even if the user tries to run it with Node.
 * It checks if it's already running under Bun, and if not, it re-executes itself using Bun.
 */

// Already running under Bun — import directly
if (typeof globalThis.Bun !== "undefined") {
  await import(entry);
} else {
  // Try to re-exec under Bun
  const result = spawnSync("bun", [entry, ...process.argv.slice(2)], {
    stdio: "inherit",
  });

  if (result.error?.code === "ENOENT") {
    console.error("aixyz-cli requires Bun.\n\nInstall it:  curl -fsSL https://bun.sh/install | bash");
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}
