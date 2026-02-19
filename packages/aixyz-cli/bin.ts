#!/usr/bin/env bun
import { program } from "commander";
import { build } from "./build";
import { dev } from "./dev";
import pkg from "./package.json";
import { t } from "./completions.js";

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
  .description("Build the aixyz agent for Vercel deployment")
  .addHelpText(
    "after",
    `
Details:
  Bundles your aixyz agent into a Vercel serverless function output.

  The build process:
    1. Loads aixyz.config.ts from the current directory
    2. Detects entrypoint (app/server.ts or auto-generates from app/agent.ts + app/tools/)
    3. Generates Vercel Build Output API v3 structure
    4. Copies static assets from public/ (if present)

  Output is written to .vercel/output/ in the current directory.

Prerequisites:
  - An aixyz.config.ts with a default export
  - An entrypoint at app/server.ts, or app/agent.ts + app/tools/ for auto-generation

Examples:
  $ aixyz build`,
  )
  .action(handleAction(build));

// Handle shell completion
if (process.argv[2] === "complete") {
  const shell = process.argv[3];
  if (shell === "--") {
    // This is a completion request, parse the remaining arguments
    const args = process.argv.slice(4);
    t.parse(args);
  } else {
    // This is a setup request for a specific shell (zsh, bash, fish, powershell)
    t.setup("aixyz", "aixyz", shell);
  }
  process.exit(0);
}

program.parse();
