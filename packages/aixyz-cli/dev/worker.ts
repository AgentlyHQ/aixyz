import chalk from "chalk";

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

  const server = Bun.serve({ port, fetch: app.fetch, idleTimeout: 255 });

  const duration = Math.round(performance.now() - startTime);
  console.log(chalk.blueBright("✓") + ` Ready in ${duration}ms`);
  console.log("");
}

main();
