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

  if (!app || typeof app.listen !== "function") {
    console.error("Error: Entrypoint must default-export an Express app");
    process.exit(1);
  }

  app.listen(port, () => {
    const duration = Math.round(performance.now() - startTime);
    console.log(`Ready in ${duration}ms`);
    console.log("");
  });
}

main();
