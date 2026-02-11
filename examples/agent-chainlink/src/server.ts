import app from "./index";

// Start server function for standalone use
export async function startServer(port?: number) {
  const PORT = port || process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    console.log(`Chainlink Price Oracle Agent server running on http://localhost:${PORT}`);
    console.log(`Agent card available at http://localhost:${PORT}/.well-known/agent-card.json`);
    console.log(`A2A endpoint at http://localhost:${PORT}/agent`);
    console.log(`MCP endpoint at http://localhost:${PORT}/mcp`);
  });

  process.on("SIGINT", () => {
    console.log("Shutting down server...");
    server.close();
    process.exit(0);
  });

  return server;
}

// Start the server when running standalone
startServer(Number(process.env.PORT) || 3000);
