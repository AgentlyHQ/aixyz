import app from "./app";

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`🚀 Chainlink Price Oracle Agent server running on http://localhost:${port}`);
  console.log(`📋 Agent card available at http://localhost:${port}/.well-known/agent-card.json`);
  console.log(`🔗 A2A endpoint at http://localhost:${port}/agent`);
  console.log(`🔌 MCP endpoint at http://localhost:${port}/mcp`);
});

// Handle server shutdown
process.on("SIGINT", () => {
  console.log("Shutting down server...");
  server.close();
  process.exit(0);
});
