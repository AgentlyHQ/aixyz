#!/usr/bin/env bun
import { program } from "commander";
import { build } from "./build";
import { dev } from "./dev";
import pkg from "./package.json";

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
  .command("dev")
  .description("Start a local development server")
  .option("-p, --port <port>", "Port to listen on", "3000")
  .action(handleAction(dev));

program
  .command("build")
  .description("Build the aixyz agent")
  .option("--output <type>", "Output format: 'standalone' or 'vercel'")
  .addHelpText(
    "after",
    `
Details:
  Bundles your aixyz agent for deployment.

  Default behavior (auto-detected):
    Bundles into a single executable file for Standalone at ./.aixyz/output/server.js

  With --output vercel or VERCEL=1 env:
    Generates Vercel Build Output API v3 structure at .vercel/output/
    (Automatically detected when deploying to Vercel)

  The build process:
    1. Loads aixyz.config.ts from the current directory
    2. Detects entrypoint (app/server.ts or auto-generates from app/agent.ts + app/tools/)
    3. Bundles the application
    4. Copies static assets from public/ (if present)

Prerequisites:
  - An aixyz.config.ts with a default export
  - An entrypoint at app/server.ts, or app/agent.ts + app/tools/ for auto-generation

Examples:
  $ aixyz build                         # Build standalone (default)
  $ aixyz build --output standalone     # Build standalone explicitly
  $ aixyz build --output vercel         # Build for Vercel deployment
  $ VERCEL=1 aixyz build                # Auto-detected Vercel build`,
  )
  .action(handleAction(build));

program.parse();
