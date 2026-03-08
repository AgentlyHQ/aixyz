import chalk from "chalk";

async function main() {
  const entrypoint = process.argv[2];
  const port = parseInt(process.argv[3], 10);

  if (!entrypoint || isNaN(port)) {
    console.error("Usage: dev-worker <entrypoint> <port>");
    process.exit(1);
  }

  const startTime = performance.now();
  const mod = await import(entrypoint);
  const app = mod.default;

  if (!app || typeof app.fetch !== "function") {
    console.error("Error: Entrypoint must default-export an AixyzServer");
    process.exit(1);
  }

  Bun.serve({
    port,
    fetch: app.fetch.bind(app),
  });

  const duration = Math.round(performance.now() - startTime);
  console.log(chalk.blueBright("✓") + ` Ready in ${duration}ms`);
  console.log("");
}

main();
