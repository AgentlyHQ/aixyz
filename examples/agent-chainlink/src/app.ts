import "dotenv/config";
import { createApp } from "./server";

// Create the Express app
const app = createApp();

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Chainlink Price Oracle Agent server running on http://localhost:${PORT}`);
  console.log(`📋 Agent card available at http://localhost:${PORT}/.well-known/agent-card.json`);
  console.log(`🔗 JSON-RPC endpoint at http://localhost:${PORT}/`);
  console.log(`🔌 MCP endpoint at http://localhost:${PORT}/mcp`);
});

// Handle server shutdown
process.on("SIGINT", () => {
  console.log("Shutting down server...");
  process.exit(0);
});
