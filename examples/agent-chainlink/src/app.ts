import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import express from "express";
import { InMemoryTaskStore } from "@a2a-js/sdk/server";
import { jsonRpcHandler, agentCardHandler, UserBuilder } from "@a2a-js/sdk/server/express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { declareDiscoveryExtension, bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { agent } from "./agent";
import { executeLookup } from "./tools/lookup";
import { getFacilitatorClient } from "aixyz/facilitator";
import { AixyzRequestHandler, getExpressApp, loadAixyzConfig } from "aixyz";
import { ToolLoopAgentExecutor } from "aixyz/server/adapters/ai";

const aixyzConfig = loadAixyzConfig();
const requestHandler = new AixyzRequestHandler(new InMemoryTaskStore(), new ToolLoopAgentExecutor(agent));

// Setup x402 payment configuration
const facilitatorClient = getFacilitatorClient();

export const resourceServer = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(resourceServer, {
  networks: [aixyzConfig.x402.network as any],
});

// Register bazaar extension for Coinbase x402 Bazaar compatibility
resourceServer.registerExtension(bazaarResourceServerExtension);

const x402Routes = {
  "POST /agent": {
    accepts: {
      scheme: "exact",
      price: "$0.01",
      network: aixyzConfig.x402.network as any,
      payTo: aixyzConfig.x402.payTo,
    },
    mimeType: "application/json",
    description: "Payment for Chainlink Price Oracle Agent API access",
    // Bazaar discovery extension for endpoint cataloging
    ...declareDiscoveryExtension({
      bodyType: "json",
      input: {
        jsonrpc: "2.0",
        method: "string",
        params: {},
        id: "number|string",
      },
      inputSchema: {
        properties: {
          jsonrpc: { type: "string", const: "2.0" },
          method: { type: "string" },
          params: { type: "object" },
          id: { type: ["number", "string"] },
        },
        required: ["jsonrpc", "method", "id"],
      },
      output: {
        example: {
          jsonrpc: "2.0",
          result: { message: "Price data response" },
          id: 1,
        },
      },
    }),
  },
  "POST /mcp": {
    accepts: {
      scheme: "exact",
      price: "$0.01",
      network: aixyzConfig.x402.network as any,
      payTo: aixyzConfig.x402.payTo,
    },
    mimeType: "application/json",
    description: "Payment for MCP protocol access to Chainlink Price Oracle Agent",
    // Bazaar discovery extension for endpoint cataloging
    ...declareDiscoveryExtension({
      bodyType: "json",
      input: {
        jsonrpc: "2.0",
        method: "string",
        params: {},
        id: "number|string",
      },
      inputSchema: {
        properties: {
          jsonrpc: { type: "string", const: "2.0" },
          method: { type: "string" },
          params: { type: "object" },
          id: { type: ["number", "string"] },
        },
        required: ["jsonrpc", "method", "id"],
      },
      output: {
        example: {
          jsonrpc: "2.0",
          result: { tools: [], protocolVersion: "2024-11-05" },
          id: 1,
        },
      },
    }),
  },
};

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
const app = getExpressApp(requestHandler, x402Routes, resourceServer);
export { app };

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

// Initialize function for serverless environments (e.g., Vercel)
let initializationPromise: Promise<void> | null = null;

export async function initializeApp() {
  if (!initializationPromise) {
    initializationPromise = resourceServer.initialize().catch((error) => {
      console.warn("[x402] Failed to initialize:", error instanceof Error ? error.message : error);
      initializationPromise = null; // Allow retry on next request
      throw error;
    });
  }
  return initializationPromise;
}

// Default export for Vercel
export default app;
