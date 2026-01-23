# Chainlink Price Oracle Agent

An AI agent that provides real-time cryptocurrency price data using Chainlink price feeds on Ethereum mainnet. This agent supports both the A2A (Agent2Agent) protocol and MCP (Model Context Protocol) for flexible integration options.

## Features

- **A2A Protocol Compliant**: Implements the Agent2Agent protocol using `@a2a-js/sdk`
- **MCP Protocol Compliant**: Implements the Model Context Protocol using `@modelcontextprotocol/sdk`
- **Chainlink Integration**: Queries real-time price feeds from Chainlink oracles
- **AI-Powered**: Uses OpenAI GPT-4o-mini for natural language interaction
- **Express Server**: HTTP server with JSON-RPC and REST endpoints
- **x402 Payment Support**: Uses `@x402/express` library for payment protocol implementation

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

3. Configure your environment variables:

```env
OPENAI_API_KEY=your_openai_api_key_here
ALCHEMY_API_KEY=your_alchemy_api_key_here
PORT=3000
AGENT_URL=http://localhost:3000/
# x402 Payment Configuration
X402_PAYMENT_ADDRESS=your_payment_address_here
X402_NETWORK=eip155:84532
X402_AMOUNT=$0.000001
X402_FACILITATOR_URL=https://x402.org/facilitator
```

## x402 Payment Protocol

This agent uses the official [`@x402/express`](https://www.npmjs.com/package/@x402/express) library to implement the x402 payment protocol for API access monetization. All JSON-RPC and MCP requests require a valid x402 payment.

### Payment Requirements

- **Cost**: $0.000001 USDC per request
- **Network**: Base Sepolia (eip155:84532)
- **Protocol**: x402 version 2
- **Scheme**: exact
- **Library**: `@x402/express` with `@x402/evm` for EVM payment processing
- **Protected Endpoints**:
  - `POST /` - JSON-RPC endpoint (A2A protocol)
  - `POST /mcp` - MCP protocol endpoint

### Implementation

The agent uses the x402 middleware from the official library:

```typescript
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://x402.org/facilitator",
});

const resourceServer = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(resourceServer, {
  networks: ["eip155:84532"], // Base Sepolia
});

app.use(paymentMiddleware(routes, resourceServer));
```

### Making Paid Requests

The x402 library handles payment verification automatically. Clients need to include valid payment headers with their requests. If no payment is provided, the server will respond with HTTP 402 (Payment Required) and include payment requirements in the response.

### Discovery (No Payment Required)

The agent card endpoint (`/.well-known/agent-card.json`) does not require payment and can be accessed freely for agent discovery.

## Running the Server

The server now runs both A2A and MCP protocols from a single application with unified endpoints.

### Development Mode

```bash
pnpm dev
```

### Production Mode

Build and run:

```bash
pnpm build
pnpm start
```

## API Endpoints

### A2A Endpoints

Once the server is running, you can access:

- **Agent Card**: `GET http://localhost:3000/.well-known/agent-card.json`
- **JSON-RPC**: `POST http://localhost:3000/` (JSON-RPC 2.0 requests)

### MCP Endpoint

The server now exposes the MCP protocol via HTTP at `/mcp`:

- **MCP Protocol**: `POST http://localhost:3000/mcp`
- **Payment Required**: Yes - x402 payment required for all MCP requests

The MCP endpoint supports:

- `POST /mcp` - MCP protocol communication (initialization and tool calls) - requires x402 payment

### MCP Tools

The MCP server exposes the following tool:

- **lookup**: Get the latest price data from Chainlink price feeds for cryptocurrency prices in USD
  - Input: `{ "symbol": "eth" }` (cryptocurrency symbol)
  - Output: Price data including current price, round ID, timestamps, and contract address

## Agent Capabilities

The Chainlink Price Oracle Agent can:

- Look up real-time cryptocurrency prices in USD
- Query Chainlink price feeds via ENS names (e.g., `eth-usd.data.eth`)
- Provide detailed price information including:
  - Current price
  - Round ID
  - Update timestamps
  - Contract addresses

## Using the MCP Server

The MCP (Model Context Protocol) server is now integrated into the main application and accessible via HTTP at the `/mcp` endpoint. This allows integration with MCP-compatible clients using HTTP transport instead of stdio.

### HTTP Transport Configuration

MCP clients can connect to the server using HTTP transport. The server supports the streamable HTTP transport protocol with session management.

Example client configuration using the MCP SDK:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport({
  url: "http://localhost:3000/mcp",
});

const client = new Client(
  {
    name: "my-client",
    version: "1.0.0",
  },
  {
    capabilities: {},
  },
);

await client.connect(transport);
```

### Features

- **Stateless**: Each request is independent - no session management needed
- **Simple**: One endpoint handles all MCP protocol requests
- **SSE Support**: Server-Sent Events for streaming responses

The `/mcp` endpoint:

- POST requests handle all MCP protocol methods (initialize, tools/list, tools/call, etc.)
- Each request creates a new server instance and closes after the response
- No session tracking or long-lived connections

## Example Queries

You can interact with the agent by sending natural language queries like:

- "What is the current price of Ethereum?"
- "Get me the latest BTC price"
- "Look up the LINK token price"

## Testing

Run the test suite:

```bash
pnpm test
```

## Deployment

### Deploying to Vercel

This agent can be easily deployed to Vercel using the included `vercel.json` configuration file.

#### Prerequisites

1. Install the Vercel CLI:

```bash
npm i -g vercel
```

2. Login to Vercel:

```bash
vercel login
```

#### Deployment Steps

1. Navigate to the agent-chainlink directory:

```bash
cd examples/agent-chainlink
```

2. Deploy to Vercel:

```bash
vercel
```

3. Set up the required environment variables in your Vercel project settings:

- `OPENAI_API_KEY`: Your OpenAI API key
- `ALCHEMY_API_KEY`: Your Alchemy API key for Ethereum access
- `X402_PAYMENT_ADDRESS`: Your payment address (Base Sepolia)
- `X402_NETWORK`: Network for payments (default: `eip155:84532`)
- `X402_AMOUNT`: Payment amount per request (default: `$0.000001`)
- `X402_FACILITATOR_URL`: x402 facilitator URL (default: `https://x402.org/facilitator`)

You can set environment variables using the Vercel CLI:

```bash
vercel env add OPENAI_API_KEY
vercel env add ALCHEMY_API_KEY
vercel env add X402_PAYMENT_ADDRESS
```

Or through the Vercel dashboard at: `https://vercel.com/[your-username]/[project-name]/settings/environment-variables`

4. After deployment, your agent will be available at the Vercel URL provided. Update the `AGENT_URL` environment variable to match your deployment URL.

#### Configuration

The `vercel.json` file configures the deployment:

- Routes all traffic to the Express app via serverless functions
- Uses the `api/index.ts` handler as the entry point
- Supports all endpoints: `/`, `/.well-known/agent-card.json`, and `/mcp`

## Architecture

The agent follows the A2A protocol architecture:

1. **Agent Card** (`AgentCard`): Metadata describing the agent's capabilities
2. **Agent Executor** (`ChainlinkAgentExecutor`): Wraps the Vercel AI SDK `ToolLoopAgent`
3. **Express Server** (`A2AExpressApp`): Exposes A2A-compliant HTTP endpoints
4. **Request Handler** (`DefaultRequestHandler`): Manages agent execution and task storage

## Dependencies

- `@a2a-js/sdk`: Agent2Agent protocol SDK
- `ai`: Vercel AI SDK for agent orchestration
- `@ai-sdk/openai`: OpenAI provider for the AI SDK
- `express`: Web server framework
- `viem`: Ethereum library for Chainlink integration
- `dotenv`: Environment variable management
