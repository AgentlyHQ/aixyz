import express from "express";
import { randomUUID } from "crypto";
import type { AgentCard, Message, TextPart } from "@a2a-js/sdk";
import {
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
  DefaultRequestHandler,
  InMemoryTaskStore,
} from "@a2a-js/sdk/server";
import { jsonRpcHandler, agentCardHandler, UserBuilder } from "@a2a-js/sdk/server/express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { declareDiscoveryExtension, bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { agent } from "./agent";
import { executeGetNewListedTokens, executeGetTokenPrice, executeGetTopGainersLosers } from "./tools";
import { getAddress } from "viem";
import { getFacilitatorClient } from "aixyz/facilitator";

// Define the agent card metadata
const agentCard: AgentCard = {
  name: "Price Gecky - Price Oracle Agent",
  description:
    "An AI agent that provides real-time cryptocurrency market data using CoinGecko Pro. Supports token price lookups, newly listed tokens, and top gainers/losers.",
  protocolVersion: "0.3.0",
  version: "1.0.0",
  url: process.env.AGENT_URL || "http://localhost:3000/",
  capabilities: {
    streaming: false,
    pushNotifications: false,
  },
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
  skills: [
    {
      id: "token-price",
      name: "Token Price Lookup",
      description: "Get the current price for any cryptocurrency token",
      tags: ["price", "cryptocurrency", "coingecko", "market"],
      examples: ["What is the price of Bitcoin?", "Get ETH price in USD", "How much is Solana worth?"],
    },
    {
      id: "new-tokens",
      name: "Newly Listed Tokens",
      description: "Discover recently listed tokens on CoinGecko",
      tags: ["new", "tokens", "listing", "discovery"],
      examples: ["Show me new tokens", "What tokens were recently listed?"],
    },
    {
      id: "gainers-losers",
      name: "Top Gainers & Losers",
      description: "Get the top gaining and losing tokens in the last 24 hours",
      tags: ["gainers", "losers", "trending", "24h"],
      examples: ["What are the top gainers today?", "Show me the biggest losers", "Which tokens are pumping?"],
    },
  ],
};

// Implement the AgentExecutor that wraps the ToolLoopAgent
class PriceOracleAgentExecutor implements AgentExecutor {
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    try {
      // Extract the user's message text
      const userMessage = requestContext.userMessage;
      const textParts = userMessage.parts.filter((part): part is TextPart => part.kind === "text");
      const prompt = textParts.map((part) => part.text).join("\n");

      // Generate a response using the ToolLoopAgent
      const result = await agent.generate({ prompt });

      // Publish the response message
      const responseMessage: Message = {
        kind: "message",
        messageId: randomUUID(),
        role: "agent",
        parts: [{ kind: "text", text: result.text }],
        contextId: requestContext.contextId,
      };

      eventBus.publish(responseMessage);
      eventBus.finished();
    } catch (error) {
      // Handle errors by publishing an error message
      const errorMessage: Message = {
        kind: "message",
        messageId: randomUUID(),
        role: "agent",
        parts: [
          {
            kind: "text",
            text: `Error: ${error instanceof Error ? error.message : "An unknown error occurred"}`,
          },
        ],
        contextId: requestContext.contextId,
      };

      eventBus.publish(errorMessage);
      eventBus.finished();
    }
  }

  async cancelTask(_taskId: string, eventBus: ExecutionEventBus): Promise<void> {
    // The ToolLoopAgent doesn't support cancellation, so we just finish
    eventBus.finished();
  }
}

// Create the agent executor and request handler
const agentExecutor = new PriceOracleAgentExecutor();
const requestHandler = new DefaultRequestHandler(agentCard, new InMemoryTaskStore(), agentExecutor);

// Setup x402 payment configuration
const facilitatorClient = getFacilitatorClient();

const resourceServer = new x402ResourceServer(facilitatorClient);
const x402Network = (process.env.X402_NETWORK || "eip155:84532") as `${string}:${string}`;
registerExactEvmScheme(resourceServer, {
  networks: [x402Network], // Base Sepolia by default
});

// Register bazaar extension for Coinbase x402 Bazaar compatibility
resourceServer.registerExtension(bazaarResourceServerExtension);

// Common payment configuration for all protected endpoints
const commonPaymentConfig = {
  scheme: "exact" as const,
  price: "$0.01",
  network: x402Network,
  payTo: getAddress(process.env.X402_PAYMENT_ADDRESS!),
};

const x402Routes = {
  "POST /agent": {
    accepts: commonPaymentConfig,
    mimeType: "application/json",
    description: "Payment for Price Oracle Agent API access",
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
    accepts: commonPaymentConfig,
    mimeType: "application/json",
    description: "Payment for MCP protocol access to Price Oracle Agent",
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
    name: "price-oracle",
    version: "1.0.0",
  });

  // Register the getNewListedTokens tool
  server.registerTool(
    "getNewListedTokens",
    {
      description: "Get newly listed tokens from CoinGecko Pro (id, symbol, name).",
      inputSchema: {},
    },
    async () => {
      try {
        const result = await executeGetNewListedTokens();
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

  // Register the getTokenPrice tool
  server.registerTool(
    "getTokenPrice",
    {
      description:
        "Get the current price for a token by CoinGecko id using /simple/price. Returns null if unavailable.",
      inputSchema: {
        id: z.string().min(1).describe("CoinGecko token id, e.g. 'bitcoin', 'ethereum'."),
        vsCurrency: z.string().min(1).default("usd").describe("Fiat currency (CoinGecko vs_currency), e.g. 'usd'."),
      },
    },
    async ({ id, vsCurrency }) => {
      try {
        const result = await executeGetTokenPrice({ id, vsCurrency: vsCurrency || "usd" });
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

  // Register the getTopGainersLosers tool
  server.registerTool(
    "getTopGainersLosers",
    {
      description:
        "Get the top gaining and losing tokens in the last 24 hours with their name, symbol, and 24h percentage change.",
      inputSchema: {},
    },
    async () => {
      try {
        const result = await executeGetTopGainersLosers();
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
const app: express.Express = express();
export { app };

// Add agent card handler at well-known path (no payment required for A2A discovery)
app.use(
  "/.well-known/agent-card.json",
  agentCardHandler({
    agentCardProvider: requestHandler,
  }),
);

// Apply x402 payment middleware to protect the root JSON-RPC endpoint
app.use(paymentMiddleware(x402Routes, resourceServer));

// Add JSON-RPC handler at root (protected by x402 payment)
app.use(
  "/agent",
  jsonRpcHandler({
    requestHandler,
    userBuilder: UserBuilder.noAuthentication,
  }),
);

// MCP endpoint - stateless, one request per connection
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
    initializationPromise = resourceServer.initialize();
  }
  return initializationPromise;
}

// Start server function for standalone use
export async function startServer(port?: number) {
  // Initialize resource server to fetch supported kinds from facilitator
  await initializeApp();

  const PORT = port || process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    console.log(`🚀 Price Oracle Agent server running on http://localhost:${PORT}`);
    console.log(`📋 Agent card available at http://localhost:${PORT}/.well-known/agent-card.json`);
    console.log(`🔗 JSON-RPC endpoint at http://localhost:${PORT}/`);
    console.log(`🔌 MCP endpoint at http://localhost:${PORT}/mcp`);
  });

  // Handle server shutdown
  process.on("SIGINT", () => {
    console.log("Shutting down server...");
    server.close();
    process.exit(0);
  });

  return server;
}

// Default export for Vercel
export default app;
