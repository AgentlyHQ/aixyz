import { resolve, join } from "path";
import { existsSync, mkdirSync, cpSync, rmSync } from "fs";
import type { BunPlugin } from "bun";

const cwd = process.cwd();

// 1. Validate — check aixyz.config.ts exists in cwd
const configTsPath = resolve(cwd, "aixyz.config.ts");
const configJsPath = resolve(cwd, "aixyz.config.js");
const configPath = existsSync(configTsPath) ? configTsPath : existsSync(configJsPath) ? configJsPath : undefined;

if (!configPath) {
  console.error("Error: No aixyz.config.ts or aixyz.config.js found in", cwd);
  process.exit(1);
}

// 2. Load config at build time
const configMod = require(configPath);
const rawConfig = configMod.default;

if (!rawConfig || typeof rawConfig !== "object") {
  console.error("Error: aixyz.config.ts must have a default export");
  process.exit(1);
}

// 3. Determine entry point
const srcIndex = resolve(cwd, "src/index.ts");
const srcApp = resolve(cwd, "src/app.ts");
const entrypoint = existsSync(srcIndex) ? srcIndex : existsSync(srcApp) ? srcApp : undefined;

if (!entrypoint) {
  console.error("Error: No src/index.ts or src/app.ts found in", cwd);
  process.exit(1);
}

// 4. Clean output directory
const outputDir = resolve(cwd, ".vercel/output");
rmSync(outputDir, { recursive: true, force: true });

// 5. Bundle with Bun.build()
const funcDir = resolve(outputDir, "functions/index.func");
mkdirSync(funcDir, { recursive: true });

// Resolve the actual config.ts path in the aixyz package
const aixyzConfigModule = resolve(import.meta.dir, "config.ts");

const configPlugin: BunPlugin = {
  name: "aixyz-config",
  setup(build) {
    build.onLoad({ filter: /packages\/aixyz\/config\.ts$/ }, () => ({
      contents: `
        export function loadAixyzConfig() {
          return ${JSON.stringify(rawConfig)};
        }
      `,
      loader: "ts",
    }));
  },
};

console.log("Building", entrypoint);

const result = await Bun.build({
  entrypoints: [entrypoint],
  outdir: funcDir,
  target: "node",
  format: "cjs",
  sourcemap: "linked",
  plugins: [configPlugin],
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
      runtime: "nodejs22.x",
      launcherType: "Nodejs",
      shouldAddHelpers: true,
      shouldAddSourcemapSupport: true,
    },
    null,
    2,
  ),
);

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
