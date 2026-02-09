#!/usr/bin/env bun
import { program } from "commander";
import { build } from "./commands/build.js";
import pkg from "../package.json";

function handleAction(
  action: (options: Record<string, unknown>) => Promise<void>,
): (options: Record<string, unknown>) => Promise<void> {
  return async (options) => {
    try {
      await action(options);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  };
}

program.name("aixyz").description("CLI for building and deploying aixyz agents").version(pkg.version);

program
  .command("build")
  .description("Build the aixyz agent for Vercel deployment")
  .addHelpText(
    "after",
    `
Details:
  Bundles your aixyz agent into a Vercel serverless function output.

  The build process:
    1. Loads aixyz.config.ts (or .js) from the current directory
    2. Detects entrypoint (src/index.ts or src/app.ts)
    3. Bundles with Bun.build() targeting Node.js (CJS)
    4. Generates Vercel Build Output API v3 structure
    5. Copies static assets from public/ (if present)

  Output is written to .vercel/output/ in the current directory.

Prerequisites:
  - An aixyz.config.ts or aixyz.config.js with a default export
  - An entrypoint at src/index.ts or src/app.ts

Examples:
  $ aixyz build`,
  )
  .action(handleAction(build));

program.parse();
