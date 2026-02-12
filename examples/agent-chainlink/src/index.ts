import express from "express";
import { InMemoryTaskStore } from "@a2a-js/sdk/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { agent, x402 } from "./agent";
import { executeLookup } from "./tools/lookup";
import { AixyzRequestHandler, initExpressApp } from "aixyz";
import { ToolLoopAgentExecutor } from "aixyz/server/adapters/ai";

// Create MCP Server instance
function createMcpServer() {
  const server = new McpServer({
    name: "chainlink-price-oracle",
    version: "1.0.0",
  });

  // Register the lookup tool
  server.registerTool(
    "lookup",
    {
      description:
        "Get the latest price data from Chainlink price feeds for cryptocurrency prices in USD. Provide a symbol like 'eth', 'btc', 'link' and it will look up the USD price feed.",
      inputSchema: {
        symbol: z
          .string()
          .describe(
            "The cryptocurrency symbol to look up, e.g. 'eth', 'btc', 'link'. Will be converted to {symbol}-usd.data.eth format.",
          ),
      },
    },
    async ({ symbol }) => {
      try {
        const result = await executeLookup({ symbol });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "An unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}

// Setup the Express app with A2A routes using specific middlewares
const requestHandler = new AixyzRequestHandler(new InMemoryTaskStore(), new ToolLoopAgentExecutor(agent));
const app = await initExpressApp(requestHandler, x402.price);

// TODO(@fuxingloh): fix this: not working properly,
//  MCP endpoint - stateless, one request per connection
app.post("/mcp", express.json(), async (req, res) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);

  // Clean up after response completes or connection closes
  const cleanup = () => {
    transport.close();
    server.close();
  };

  res.on("finish", cleanup);
  res.on("close", cleanup);
});

// Default export for Vercel
export default app;
