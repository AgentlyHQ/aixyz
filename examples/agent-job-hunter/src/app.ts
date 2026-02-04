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
import { HTTPFacilitatorClient } from "@x402/core/server";
import { declareDiscoveryExtension, bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { agent } from "./agent";
import { executeJobSearch } from "./tools";
import { getAddress } from "viem";

// Define the agent card metadata
const agentCard: AgentCard = {
  name: "Job Hunter - Career Scout Agent",
  description:
    "An AI agent that searches for remote job opportunities worldwide using the Jobicy API. Provides the latest remote job listings for specific countries.",
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
      id: "job-search",
      name: "Remote Job Search",
      description: "Search for the latest remote job opportunities in specific countries",
      tags: ["jobs", "remote", "career", "employment", "hiring"],
    },
  ],
};

// Implement the AgentExecutor that wraps the ToolLoopAgent
class JobHunterAgentExecutor implements AgentExecutor {
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
const agentExecutor = new JobHunterAgentExecutor();
const requestHandler = new DefaultRequestHandler(agentCard, new InMemoryTaskStore(), agentExecutor);

// Setup x402 payment configuration
const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL || "https://www.x402.org/facilitator",
});

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
    description: "Payment for Job Hunter Agent API access",
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
          result: { message: "Job search results" },
          id: 1,
        },
      },
    }),
  },
  "POST /mcp": {
    accepts: commonPaymentConfig,
    mimeType: "application/json",
    description: "Payment for MCP protocol access to Job Hunter Agent",
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
    name: "job-hunter",
    version: "1.0.0",
  });

  // Register the searchJobs tool
  server.registerTool(
    "searchJobs",
    {
      description:
        "Fetch the latest remote jobs from Jobicy for a specific country (geo). Provide a country or region like 'canada', 'usa', 'uk' to get remote job listings.",
      inputSchema: {
        geo: z.string().describe("The country or region to search for (e.g., 'canada', 'usa', 'uk')."),
      },
    },
    async ({ geo }) => {
      try {
        const result = await executeJobSearch({ geo });
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
    console.log(`🚀 Job Hunter Agent server running on http://localhost:${PORT}`);
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
