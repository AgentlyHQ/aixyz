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
  .option("--vercel", "Build for Vercel deployment with serverless function output")
  .addHelpText(
    "after",
    `
Details:
  Bundles your aixyz agent for deployment.

  Default behavior:
    Bundles into a single executable file for Bun Runtime at ./dist/server.js

  With --vercel flag:
    Generates Vercel Build Output API v3 structure at .vercel/output/

  The build process:
    1. Loads aixyz.config.ts from the current directory
    2. Detects entrypoint (app/server.ts or auto-generates from app/agent.ts + app/tools/)
    3. Bundles the application
    4. Copies static assets from public/ (if present)

Prerequisites:
  - An aixyz.config.ts with a default export
  - An entrypoint at app/server.ts, or app/agent.ts + app/tools/ for auto-generation

Examples:
  $ aixyz build                # Build for Bun Runtime (default)
  $ aixyz build --vercel       # Build for Vercel deployment`,
  )
  .action(handleAction(build));

program.parse();
