import { resolve } from "path";
import { existsSync, mkdirSync, cpSync, rmSync } from "fs";
import { AixyzConfigPlugin } from "./AixyzConfigPlugin";
import { AixyzServerPlugin, getEntrypointMayGenerate } from "./AixyzServerPlugin";
import { getAixyzConfig } from "@aixyz/config";
import { loadEnvConfig } from "@next/env";
import chalk from "chalk";

interface BuildOptions {
  output?: string;
}

export async function build(options: BuildOptions = {}): Promise<void> {
  const cwd = process.cwd();
  loadEnvConfig(cwd, false);
  const entrypoint = getEntrypointMayGenerate(cwd, "build");

  // Determine output target: explicit CLI flag takes precedence, then config file, then auto-detect VERCEL env
  const config = getAixyzConfig();
  const target = options.output ?? config.build?.output ?? (process.env.VERCEL === "1" ? "vercel" : "standalone");

  if (target === "vercel") {
    console.log(chalk.cyan("▶") + " Building for " + chalk.bold("Vercel") + "...");
    await buildVercel(entrypoint);
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

  const iconFile = resolve(cwd, "app/icon.png");
  if (existsSync(iconFile)) {
    cpSync(iconFile, resolve(outputDir, "icon.png"));
  }

  // Log summary
  console.log("");
  console.log("Build complete! Output:");
  console.log("  .aixyz/output/server.js");
  console.log("  .aixyz/output/package.json");
  if (existsSync(publicDir) || existsSync(iconFile)) {
    console.log("  .aixyz/output/public/ and assets");
  }
  console.log("");
  console.log("To run: bun .aixyz/output/server.js");
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

  const iconFile = resolve(cwd, "app/icon.png");
  if (existsSync(iconFile)) {
    mkdirSync(staticDir, { recursive: true });
    cpSync(iconFile, resolve(staticDir, "icon.png"));
    console.log("Copied app/icon.png →", staticDir);
  }

  // Log summary
  console.log("");
  console.log("Build complete! Output:");
  console.log("  .vercel/output/config.json");
  console.log("  .vercel/output/functions/index.func/server.js");
  console.log("  .vercel/output/static/");
}
