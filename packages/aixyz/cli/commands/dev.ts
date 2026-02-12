import { resolve } from "path";
import { existsSync } from "fs";
import { loadEnvConfig } from "@next/env";
import pkg from "../../package.json";

export async function dev(options: { port?: string }): Promise<void> {
  const startTime = performance.now();
  const cwd = process.cwd();

  // Load environment config
  const { loadedEnvFiles } = loadEnvConfig(cwd, true);
  const envFileNames = loadedEnvFiles.map((f) => f.path.replace(cwd + "/", ""));

  // Find entrypoint
  const srcIndex = resolve(cwd, "src/index.ts");
  const srcApp = resolve(cwd, "src/app.ts");
  const entrypoint = existsSync(srcIndex) ? srcIndex : existsSync(srcApp) ? srcApp : undefined;

  if (!entrypoint) {
    throw new Error(`No src/index.ts or src/app.ts found in ${cwd}`);
  }

  // Import the app (default export should be an Express app)
  const mod = await import(entrypoint);
  const app = mod.default;

  if (!app || typeof app.listen !== "function") {
    throw new Error(`Entrypoint must default-export an Express app`);
  }

  // Determine port
  const port = parseInt(options.port || process.env.PORT || "3000", 10);

  // Start server
  const server = app.listen(port, () => {
    const duration = Math.round(performance.now() - startTime);
    const baseUrl = `http://localhost:${port}`;

    console.log("");
    console.log(`🐁  ai-xyz.dev v${pkg.version}`);
    console.log("");
    console.log(`- A2A:          ${baseUrl}/.well-known/agent-card.json`);
    console.log(`- MCP:          ${baseUrl}/mcp`);
    if (envFileNames.length > 0) {
      console.log(`- Environments: ${envFileNames.join(", ")}`);
    }
    console.log("");
    console.log(`Ready in ${duration}ms`);
    console.log("");
  });

  process.on("SIGINT", () => {
    server.close();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    server.close();
    process.exit(0);
  });
}
