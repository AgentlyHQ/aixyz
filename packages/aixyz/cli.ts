#!/usr/bin/env bun

const command = process.argv[2];

if (command === "build") {
  await import("./build");
} else {
  console.error(`Unknown command: ${command ?? "(none)"}`);
  console.error("Usage: aixyz build");
  process.exit(1);
}
