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
import { x402ResourceServer } from "@x402/express";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { declareDiscoveryExtension, bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { agent } from "./agent";
import { executeSearchFlights, POPULAR_DESTINATIONS, type SearchFlightsInput } from "./tools";
import { initializeStripe, createPaymentIntent } from "./stripe";
import { unifiedPaymentMiddleware } from "./payment-middleware";

// Define the agent card metadata
const agentCard: AgentCard = {
  name: "Travel Agent - Flight Search",
  description:
    "An AI travel agent that finds the cheapest flights between multiple departure airports and destinations worldwide using real-time pricing data",
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
      id: "flight-search",
      name: "Cheapest Flight Search",
      description:
        "Search for the cheapest flights between airports with support for multiple departures, destinations, currencies, and trip types",
      tags: ["travel", "flights", "booking", "deals", "airlines"],
    },
  ],
};

// Implement the AgentExecutor that wraps the ToolLoopAgent
class TravelAgentExecutor implements AgentExecutor {
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
const agentExecutor = new TravelAgentExecutor();
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
  price: process.env.X402_AMOUNT || "$0.001",
  network: x402Network,
  payTo: process.env.X402_PAYMENT_ADDRESS || "0x0000000000000000000000000000000000000000",
};

const x402Routes = {
  "POST /": {
    accepts: commonPaymentConfig,
    mimeType: "application/json",
    description: "Payment for Travel Agent Flight Search API access",
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
          result: { message: "Flight search results" },
          id: 1,
        },
      },
    }),
  },
  "POST /mcp": {
    accepts: commonPaymentConfig,
    mimeType: "application/json",
    description: "Payment for MCP protocol access to Travel Agent Flight Search",
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
    name: "travel-agent-flight-search",
    version: "1.0.0",
  });

  // Register the searchFlights tool
  server.registerTool(
    "searchFlights",
    {
      description:
        "Search for the cheapest flights between multiple departure airports and destinations. Returns flight deals with prices, dates, discounts, and booking links.",
      inputSchema: {
        departures: z.array(z.string()).min(1).describe("Array of departure airport IATA codes"),
        destinations: z.array(z.string()).optional().describe("Array of destination airport IATA codes"),
        language: z.string().optional().describe("Language for the response (default: en-US)"),
        currency: z.string().optional().describe("Currency for prices (default: USD)"),
        tripType: z.enum(["roundtrip", "oneway"]).optional().describe("Type of trip (default: roundtrip)"),
        minTripLength: z.number().optional().describe("Minimum trip length in days (default: 5)"),
        startDate: z.string().nullable().optional().describe("Start date for search range (YYYY-MM-DD)"),
        endDate: z.string().nullable().optional().describe("End date for search range (YYYY-MM-DD)"),
      },
    },
    async (input) => {
      try {
        const searchInput: SearchFlightsInput = {
          departures: input.departures as string[],
          destinations: input.destinations as string[] | undefined,
          language: input.language as string | undefined,
          currency: input.currency as string | undefined,
          tripType: input.tripType as "roundtrip" | "oneway" | undefined,
          minTripLength: input.minTripLength as number | undefined,
          startDate: input.startDate as string | null | undefined,
          endDate: input.endDate as string | null | undefined,
        };
        const result = await executeSearchFlights(searchInput);
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

  // Register a helper tool to get popular destinations
  server.registerTool(
    "getPopularDestinations",
    {
      description: "Get a list of popular destination IATA codes that can be used for flight searches",
      inputSchema: {},
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ destinations: POPULAR_DESTINATIONS }, null, 2),
          },
        ],
      };
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

// Create PaymentIntent for client-side payment flow
app.post("/stripe/create-payment-intent", express.json(), async (req, res) => {
  console.log("[Stripe] create-payment-intent endpoint hit");
  try {
    // Ensure Stripe is initialized (important for serverless environments)
    await initializeApp();
    console.log("[Stripe] initializeApp() completed");

    const result = await createPaymentIntent({
      priceInCents: Number(process.env.STRIPE_PRICE_CENTS) || 100,
    });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create payment intent";
    console.error("[Stripe] Failed to create payment intent:", message);
    const status = message === "Stripe not configured" ? 503 : 500;
    res.status(status).json({ error: message });
  }
});

// Apply unified payment middleware to protect the root JSON-RPC and MCP endpoints
const stripeEnabled = !!process.env.STRIPE_SECRET_KEY;
app.use(
  unifiedPaymentMiddleware({
    x402: { routes: x402Routes, resourceServer },
    stripe: {
      enabled: stripeEnabled,
      priceInCents: Number(process.env.STRIPE_PRICE_CENTS) || 100,
    },
  }),
);

// Add JSON-RPC handler at root (protected by x402 payment)
app.use(
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
  console.log("[App] initializeApp() called, promise exists:", !!initializationPromise);
  if (!initializationPromise) {
    initializationPromise = (async () => {
      console.log("[App] Running initialization...");
      // Initialize Stripe first (independent of x402)
      initializeStripe();

      // Initialize x402 resource server (non-fatal if fails)
      try {
        await resourceServer.initialize();
      } catch (error) {
        console.warn("[x402] Failed to initialize:", error instanceof Error ? error.message : error);
        console.warn("[x402] x402 payments will not be available. Stripe payments will still work.");
      }
    })();
  }
  return initializationPromise;
}

// Start server function for standalone use
export async function startServer(port?: number) {
  // Initialize resource server to fetch supported kinds from facilitator
  await initializeApp();

  const PORT = port || process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    console.log(`Travel Agent Flight Search server running on http://localhost:${PORT}`);
    console.log(`Agent card available at http://localhost:${PORT}/.well-known/agent-card.json`);
    console.log(`JSON-RPC endpoint at http://localhost:${PORT}/`);
    console.log(`MCP endpoint at http://localhost:${PORT}/mcp`);
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
