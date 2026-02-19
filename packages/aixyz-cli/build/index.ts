import { resolve } from "path";
import { existsSync, mkdirSync, cpSync, rmSync } from "fs";
import { AixyzConfigPlugin } from "./AixyzConfigPlugin";
import { AixyzServerPlugin, getEntrypointMayGenerate } from "./AixyzServerPlugin";

export async function build(): Promise<void> {
  const cwd = process.cwd();

  const entrypoint = getEntrypointMayGenerate(cwd, "build");

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
    plugins: [AixyzConfigPlugin(), AixyzServerPlugin(entrypoint)],
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
        runtime: "bun",
        launcherType: "Bun",
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
  console.log("  .vercel/output/functions/index.func/index.js");
  console.log("  .vercel/output/static/");
}
