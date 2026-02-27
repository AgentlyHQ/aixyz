import { resolve } from "path";
import { existsSync, mkdirSync, cpSync, rmSync } from "fs";
import { Command } from "commander";
import { AixyzConfigPlugin } from "./AixyzConfigPlugin";
import { AixyzServerPlugin, getEntrypointMayGenerate } from "./AixyzServerPlugin";
import { findIconFile, copyAgentIcon, generateFavicon } from "./icons";
import { getAixyzConfig } from "@aixyz/config";
import { loadEnvConfig } from "@next/env";
import chalk from "chalk";

interface BuildOptions {
  output?: string;
}

export const buildCommand = new Command("build")
  .description("Build the aixyz agent")
  .option("--output <type>", "Output format: 'standalone', 'vercel', or 'executable'")
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

  With --output executable:
    Compiles into a self-contained binary at ./.aixyz/output/aixyz
    (No Bun runtime required to run the output)

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
  $ aixyz build --output executable     # Build self-contained binary
  $ VERCEL=1 aixyz build                # Auto-detected Vercel build`,
  )
  .action(action);

async function action(options: BuildOptions = {}): Promise<void> {
  const cwd = process.cwd();
  loadEnvConfig(cwd, false);
  process.env.NODE_ENV = "production";
  process.env.AIXYZ_ENV = "production";
  const entrypoint = getEntrypointMayGenerate(cwd, "build");

  // Determine output target: explicit CLI flag takes precedence, then config file, then auto-detect VERCEL env
  const config = getAixyzConfig();
  const target = options.output ?? config.build?.output ?? (process.env.VERCEL === "1" ? "vercel" : "standalone");

  if (target === "vercel") {
    console.log(chalk.cyan("▶") + " Building for " + chalk.bold("Vercel") + "...");
    await buildVercel(entrypoint);
  } else if (target === "executable") {
    console.log(chalk.cyan("▶") + " Building " + chalk.bold("Executable") + "...");
    await buildExecutable(entrypoint);
  } else {
    console.log(chalk.cyan("▶") + " Building for " + chalk.bold("Standalone") + "...");
    await buildBun(entrypoint);
  }
}

async function buildBun(entrypoint: string): Promise<void> {
  const cwd = process.cwd();

  const outputDir = resolve(cwd, ".aixyz/output");
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  // Build as a single bundled file for Bun Runtime
  const result = await Bun.build({
    entrypoints: [entrypoint],
    outdir: outputDir,
    naming: "server.js",
    target: "bun",
    format: "esm",
    sourcemap: "linked",
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
      "process.env.AIXYZ_ENV": JSON.stringify("production"),
    },
    plugins: [AixyzConfigPlugin(), AixyzServerPlugin(entrypoint, "standalone")],
  });

  if (!result.success) {
    console.error("Build failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  // Write package.json for ESM support
  await Bun.write(resolve(outputDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));

  // Copy static assets (public/ → .aixyz/output/public/)
  const publicDir = resolve(cwd, "public");
  if (existsSync(publicDir)) {
    const destPublicDir = resolve(outputDir, "public");
    cpSync(publicDir, destPublicDir, { recursive: true });
    console.log("Copied public/ →", destPublicDir);
  }

  const iconFile = findIconFile(resolve(cwd, "app"));
  if (iconFile) {
    await copyAgentIcon(iconFile, resolve(outputDir, "icon.png"));
    await generateFavicon(iconFile, resolve(outputDir, "public/favicon.ico"));
  }

  // Log summary
  console.log("");
  console.log("Build complete! Output:");
  console.log("  .aixyz/output/server.js");
  console.log("  .aixyz/output/package.json");
  if (existsSync(publicDir) || iconFile) {
    console.log("  .aixyz/output/public/ and assets");
  }
  console.log("");
  console.log("To run: bun .aixyz/output/server.js");
}

async function buildExecutable(entrypoint: string): Promise<void> {
  const cwd = process.cwd();

  const outputDir = resolve(cwd, ".aixyz/output");
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const outfile = resolve(outputDir, "aixyz");

  // Build as a self-contained compiled binary using Bun's compile feature
  const result = await Bun.build({
    entrypoints: [entrypoint],
    outdir: outputDir,
    target: "bun",
    sourcemap: "linked",
    compile: { outfile },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
      "process.env.AIXYZ_ENV": JSON.stringify("production"),
    },
    plugins: [AixyzConfigPlugin(), AixyzServerPlugin(entrypoint, "executable")],
  });

  if (!result.success) {
    console.error("Build failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  // Copy static assets (public/ → .aixyz/output/public/)
  const publicDir = resolve(cwd, "public");
  if (existsSync(publicDir)) {
    const destPublicDir = resolve(outputDir, "public");
    cpSync(publicDir, destPublicDir, { recursive: true });
    console.log("Copied public/ →", destPublicDir);
  }

  const iconFile = findIconFile(resolve(cwd, "app"));
  if (iconFile) {
    await copyAgentIcon(iconFile, resolve(outputDir, "icon.png"));
    await generateFavicon(iconFile, resolve(outputDir, "public/favicon.ico"));
  }

  // Log summary
  console.log("");
  console.log("Build complete! Output:");
  console.log("  .aixyz/output/aixyz");
  if (existsSync(publicDir) || iconFile) {
    console.log("  .aixyz/output/public/ and assets");
  }
  console.log("");
  console.log("To run: ./.aixyz/output/aixyz");
}

async function buildVercel(entrypoint: string): Promise<void> {
  const cwd = process.cwd();

  const outputDir = resolve(cwd, ".vercel/output");
  rmSync(outputDir, { recursive: true, force: true });

  const funcDir = resolve(outputDir, "functions/index.func");
  mkdirSync(funcDir, { recursive: true });

  // Write functions/index.func
  const result = await Bun.build({
    entrypoints: [entrypoint],
    outdir: funcDir,
    naming: "server.js",
    target: "bun",
    format: "esm",
    sourcemap: "linked",
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
      "process.env.AIXYZ_ENV": JSON.stringify("production"),
    },
    plugins: [AixyzConfigPlugin(), AixyzServerPlugin(entrypoint, "vercel")],
  });

  if (!result.success) {
    console.error("Build failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  // Write .vc-config.json
  await Bun.write(
    resolve(funcDir, ".vc-config.json"),
    JSON.stringify(
      {
        handler: "server.js",
        runtime: "bun1.x",
        launcherType: "Bun",
        shouldAddHelpers: true,
        shouldAddSourcemapSupport: true,
      },
      null,
      2,
    ),
  );

  // Write package.json for ESM support
  await Bun.write(resolve(funcDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));

  // Write config.json
  await Bun.write(
    resolve(outputDir, "config.json"),
    JSON.stringify(
      {
        version: 3,
        routes: [{ handle: "filesystem" }, { src: "/(.*)", dest: "/" }],
      },
      null,
      2,
    ),
  );

  // Copy static assets (public/ → .vercel/output/static/)
  const staticDir = resolve(outputDir, "static");

  const publicDir = resolve(cwd, "public");
  if (existsSync(publicDir)) {
    cpSync(publicDir, staticDir, { recursive: true });
    console.log("Copied public/ →", staticDir);
  }

  const iconFile = findIconFile(resolve(cwd, "app"));
  if (iconFile) {
    mkdirSync(staticDir, { recursive: true });
    await copyAgentIcon(iconFile, resolve(staticDir, "icon.png"));
    await generateFavicon(iconFile, resolve(staticDir, "favicon.ico"));
    console.log("Copied app/icon →", staticDir);
  }

  // Log summary
  console.log("");
  console.log("Build complete! Output:");
  console.log("  .vercel/output/config.json");
  console.log("  .vercel/output/functions/index.func/server.js");
  console.log("  .vercel/output/static/");
}
