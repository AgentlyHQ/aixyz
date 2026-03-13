import { resolve, relative } from "path";
import { existsSync, watch } from "fs";
import { loadEnvConfig } from "@next/env";
import { Command } from "commander";
import { getEntrypointMayGenerate } from "../build/AixyzServerPlugin";
import chalk from "chalk";
import pkg from "../package.json";

export const devCommand = new Command("dev")
  .description("Start a local development server")
  .option("-p, --port <port>", "Port to listen on")
  .action(action);

type DevOptions = {
  port?: string;
  // Internal option, not exposed to CLI
  appDir?: string;
};

export async function action(options: DevOptions): Promise<void> {
  const cwd = process.cwd();

  // Load environment config
  const { loadedEnvFiles } = loadEnvConfig(cwd, true);
  process.env.NODE_ENV = "development";
  process.env.AIXYZ_ENV = "development";
  const envFileNames = loadedEnvFiles.map((f) => relative(cwd, f.path));

  const port = options.port || process.env.PORT || "3000";
  const appDir = options.appDir || "app";
  const baseUrl = `http://localhost:${port}`;

  console.log("");
  console.log(chalk.blueBright(`➫ aixyz.sh v${pkg.version}`));
  console.log(`- A2A:           ${baseUrl}/.well-known/agent-card.json`);
  console.log(`- MCP:           ${baseUrl}/mcp`);
  if (envFileNames.length > 0) {
    console.log(`- Environments:  ${envFileNames.join(", ")}`);
  }
  console.log("");

  // Spawn worker process
  const workerPath = resolve(__dirname, "worker.js");
  let child: ReturnType<typeof Bun.spawn> | null = null;
  let restarting = false;

  function startServer() {
    const { path: endpoint, isCustom } = getEntrypointMayGenerate(cwd, appDir, "dev");
    const args = ["bun", workerPath, endpoint, port];
    if (isCustom) args.push("custom");
    child = Bun.spawn(args, {
      cwd,
      stdout: "inherit",
      stderr: "inherit",
      env: { ...process.env, NODE_ENV: "development", AIXYZ_ENV: "development" },
    });
    child.exited.then((code) => {
      if (!restarting && code !== 0) {
        console.log(`\nServer exited with code ${code}, waiting for changes...`);
      }
    });
  }

  async function restartServer(reason: string) {
    restarting = true;
    if (child) {
      child.kill();
      await child.exited;
      child = null;
    }
    restarting = false;
    console.log(`Restarting... ${reason}`);
    startServer();
  }

  startServer();

  // Watch app/ for changes
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleRestart(reason: string) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      restartServer(reason);
    }, 100);
  }

  watch(resolve(cwd, appDir), { recursive: true }, (_event, filename) => {
    scheduleRestart(filename ? `${filename} changed` : "file changed");
  });

  // Watch config file
  const configFile = resolve(cwd, "aixyz.config.ts");
  if (existsSync(configFile)) {
    watch(configFile, () => {
      scheduleRestart("config changed");
    });
  }

  // Handle shutdown
  process.on("SIGINT", () => {
    if (child) child.kill();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    if (child) child.kill();
    process.exit(0);
  });

  // Keep the process alive
  await new Promise(() => {});
}
