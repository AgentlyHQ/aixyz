import chalk from "chalk";
import { existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

/** Build a static file map for Bun.serve({ static }) from app/icon.* and public/. */
function buildStaticMap(): Record<string, Response> {
  const cwd = process.cwd();
  const staticMap: Record<string, Response> = {};

  // Serve app/icon.* at /icon.png (raw file — no build-time conversion in dev)
  const iconExts = ["png", "svg", "jpeg", "jpg"];
  for (const ext of iconExts) {
    const iconPath = resolve(cwd, "app", `icon.${ext}`);
    if (existsSync(iconPath)) {
      staticMap["/icon.png"] = new Response(Bun.file(iconPath));
      break;
    }
  }

  // Serve public/ directory contents at root paths (e.g. public/robots.txt → /robots.txt)
  const publicDir = resolve(cwd, "public");
  if (existsSync(publicDir)) {
    (function walk(dir: string, prefix: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const filePath = join(dir, entry.name);
        if (entry.isFile()) {
          staticMap[prefix + "/" + entry.name] = new Response(Bun.file(filePath));
        } else if (entry.isDirectory()) {
          walk(filePath, prefix + "/" + entry.name);
        }
      }
    })(publicDir, "");
  }

  return staticMap;
}

async function main() {
  const entrypoint = process.argv[2];
  const port = parseInt(process.argv[3], 10);
  const isCustom = process.argv[4] === "custom";

  if (!entrypoint || isNaN(port)) {
    console.error("Usage: dev-worker <entrypoint> <port> [custom]");
    process.exit(1);
  }

  // Expose port so config.url fallback picks it up
  process.env.PORT = String(port);

  const startTime = performance.now();
  const mod = await import(entrypoint);

  if (isCustom) {
    // Custom server.ts manages its own lifecycle (e.g. Express, Fastify)
    const duration = Math.round(performance.now() - startTime);
    console.log(chalk.blueBright("✓") + ` Ready in ${duration}ms`);
    console.log("");
    return;
  }

  const app = mod.default;

  if (!app || typeof app.fetch !== "function") {
    console.error("Error: Entrypoint must default-export an AixyzApp");
    process.exit(1);
  }

  const server = Bun.serve({
    port,
    static: buildStaticMap(),
    fetch: app.fetch,
    idleTimeout: 255,
  } as Parameters<typeof Bun.serve>[0]);

  const duration = Math.round(performance.now() - startTime);
  console.log(chalk.blueBright("✓") + ` Ready in ${duration}ms`);
  console.log("");
}

main();
