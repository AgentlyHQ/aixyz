import { resolve } from "path";
import { existsSync, mkdirSync, cpSync, rmSync } from "fs";
import { AixyzConfigPlugin } from "./AixyzConfigPlugin";

export async function build(): Promise<void> {
  const cwd = process.cwd();

  const srcIndex = resolve(cwd, "src/index.ts");
  const srcApp = resolve(cwd, "src/app.ts");
  const entrypoint = existsSync(srcIndex) ? srcIndex : existsSync(srcApp) ? srcApp : undefined;

  if (!entrypoint) {
    throw new Error(`No src/index.ts or src/app.ts found in ${cwd}`);
  }

  // 4. Clean output directory
  const outputDir = resolve(cwd, ".vercel/output");
  rmSync(outputDir, { recursive: true, force: true });

  // 5. Bundle with Bun.build()
  const funcDir = resolve(outputDir, "functions/index.func");
  mkdirSync(funcDir, { recursive: true });

  console.log("Building", entrypoint);

  const result = await Bun.build({
    entrypoints: [entrypoint],
    outdir: funcDir,
    target: "node",
    format: "esm",
    sourcemap: "linked",
    plugins: [await AixyzConfigPlugin()],
  });

  if (!result.success) {
    console.error("Build failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  // 6. Write .vc-config.json
  await Bun.write(
    resolve(funcDir, ".vc-config.json"),
    JSON.stringify(
      {
        handler: "index.js",
        runtime: "nodejs24.x",
        launcherType: "Nodejs",
        shouldAddHelpers: true,
        shouldAddSourcemapSupport: true,
      },
      null,
      2,
    ),
  );

  // 6b. Write package.json for ESM support
  await Bun.write(resolve(funcDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));

  // 7. Write config.json
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

  // 8. Copy static assets (public/ → .vercel/output/static/)
  const publicDir = resolve(cwd, "public");
  if (existsSync(publicDir)) {
    const staticDir = resolve(outputDir, "static");
    cpSync(publicDir, staticDir, { recursive: true });
    console.log("Copied public/ →", staticDir);
  }

  // 9. Log summary
  console.log("");
  console.log("Build complete! Output:");
  console.log("  .vercel/output/config.json");
  console.log("  .vercel/output/functions/index.func/index.js");
  console.log("  .vercel/output/functions/index.func/index.js.map");
  console.log("  .vercel/output/functions/index.func/.vc-config.json");
  if (existsSync(publicDir)) {
    console.log("  .vercel/output/static/");
  }
}
