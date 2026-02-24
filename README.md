# aixyz

Framework for bundling AI agents into deployable services with A2A, MCP, x402 payments, and ERC-8004 identity.

Write your agent logic. aixyz wires up the protocols, payments, and deployment.

## Prerequisites

Install [Bun](https://bun.sh) if you don't have it:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Quick Start

```bash
bunx create-aixyz-app my-agent
cd my-agent
bun install
bun run dev
```

Your agent is running. It exposes:

| Endpoint                       | Protocol | What it does                         |
| ------------------------------ | -------- | ------------------------------------ |
| `/.well-known/agent-card.json` | A2A      | Agent discovery card                 |
| `/agent`                       | A2A      | JSON-RPC endpoint, x402 payment gate |
| `/mcp`                         | MCP      | Tool sharing with MCP clients        |

## How It Works

An aixyz agent has three parts: a config, an agent, and tools.

### 1. Config

`aixyz.config.ts` declares your agent's identity, payment address, and skills:

```ts
import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Weather Agent",
  description: "Get current weather for any location worldwide.",
  version: "0.1.0",
  x402: {
    payTo: "0x...",
    network: "eip155:8453", // Base mainnet
  },
  skills: [
    {
      id: "get-weather",
      name: "Get Weather",
      description: "Get current weather conditions for any city or location",
      tags: ["weather"],
      examples: ["What's the weather in Tokyo?"],
    },
  ],
};

export default config;
```

### 2. Agent

`app/agent.ts` defines your agent and its payment price:

```ts
import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";
import weather from "./tools/weather";

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.005",
};

export default new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: "You are a helpful weather assistant.",
  tools: { weather },
  stopWhen: stepCountIs(10),
});
```

### 3. Tools

Each file in `app/tools/` exports a Vercel AI SDK `tool` and an optional `accepts` for MCP payment gating:

```ts
import { tool } from "ai";
import { z } from "zod";
import type { Accepts } from "aixyz/accepts";

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.0001",
};

export default tool({
  description: "Get current weather conditions for a city.",
  inputSchema: z.object({
    location: z.string().describe("City name"),
  }),
  execute: async ({ location }) => {
    // your logic here
  },
});
```

That's it. Run `bun run dev` and aixyz auto-generates the server, wires up A2A + MCP + x402, and starts serving.

## Custom Server

For full control, create `app/server.ts` instead. This takes precedence over auto-generation:

```ts
import { AixyzServer } from "aixyz/server";
import { useA2A } from "aixyz/server/adapters/a2a";
import { AixyzMCP } from "aixyz/server/adapters/mcp";

import * as agent from "./agent";
import lookup from "./tools/lookup";

const server = new AixyzServer();
await server.initialize();

// A2A: agent discovery + JSON-RPC endpoint
useA2A(server, agent);

// MCP: expose tools to MCP clients
const mcp = new AixyzMCP(server);
await mcp.register("lookup", {
  default: lookup,
  accepts: { scheme: "exact", price: "$0.001" },
});
await mcp.connect();

export default server;
```

## Configuration

| Field          | Type           | Required | Description                                        |
| -------------- | -------------- | -------- | -------------------------------------------------- |
| `name`         | `string`       | Yes      | Agent display name                                 |
| `description`  | `string`       | Yes      | What the agent does                                |
| `version`      | `string`       | Yes      | Semver version                                     |
| `url`          | `string`       | No       | Agent base URL. Auto-detected on Vercel            |
| `x402.payTo`   | `string`       | Yes      | EVM address to receive payments                    |
| `x402.network` | `string`       | Yes      | Payment network (`eip155:8453` for Base)           |
| `skills`       | `AgentSkill[]` | Yes      | Skills your agent exposes (used in A2A agent card) |

Environment variables are loaded in the same order as Next.js: `.env`, `.env.local`, `.env.$(NODE_ENV)`,
`.env.$(NODE_ENV).local`.

### Payment (Accepts)

Each agent and tool declares an `accepts` export to control payment:

```ts
// Require x402 payment
export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.005", // USD-denominated
  network: "eip155:8453", // optional, defaults to config.x402.network
  payTo: "0x...", // optional, defaults to config.x402.payTo
};
```

Agents and tools without an `accepts` export are not registered.

## CLI

### `aixyz dev`

Starts a local dev server with hot reload. Watches `app/` and `aixyz.config.ts` for changes.

```bash
aixyz dev          # default port 3000
aixyz dev -p 4000  # custom port
```

### `aixyz build`

Bundles your agent for Vercel deployment. Outputs [Vercel Build Output API v3](https://vercel.com/docs/build-output-api/v3) to
`.vercel/output/`.

```bash
aixyz build
vercel deploy
```

### `agently-cli`

Register and manage on-chain agent identity (ERC-8004):

```bash
agently-cli register --chain base-sepolia --broadcast
agently-cli set-agent-uri --agent-id 1 --uri "https://my-agent.vercel.app/.well-known/agent-card.json"
```

## Protocols

**A2A (Agent-to-Agent)** — Generates an agent card at `/.well-known/agent-card.json` and a JSON-RPC endpoint at
`/agent`. Protocol version 0.3.0. Other agents discover yours and send tasks via JSON-RPC.

**MCP (Model Context Protocol)** — Exposes your tools at `/mcp` using
`StreamableHTTPServerTransport`. Any MCP client (Claude Desktop, VS Code, Cursor) can connect and call your tools.

**x402** — HTTP 402 micropayments. Clients pay per-request with an
`X-Payment` header containing cryptographic payment proof. No custodial wallets, no subscriptions. Payments are verified on-chain via a facilitator.

**ERC-8004
** — On-chain agent identity. Register your agent on Ethereum, Base, Polygon, Scroll, Monad, BSC, or Gnosis so other agents and contracts can reference it.

## Agent File Structure

```
my-agent/
  aixyz.config.ts     # Agent config (required)
  app/
    agent.ts          # Agent definition (required if no server.ts)
    server.ts         # Custom server (optional, overrides auto-generation)
    tools/
      weather.ts      # Tool exports (files starting with _ are ignored)
    icon.png          # Agent icon (served as static asset)
  public/             # Static assets
  vercel.json         # Vercel deployment config
  .env.local          # Local environment variables
```

## Environment Variables

| Variable               | Description                                                      |
| ---------------------- | ---------------------------------------------------------------- |
| `X402_PAY_TO`          | Default payment recipient address                                |
| `X402_NETWORK`         | Default payment network (e.g. `eip155:8453`)                     |
| `X402_FACILITATOR_URL` | Custom facilitator (default: `https://www.x402.org/facilitator`) |
| `CDP_API_KEY_ID`       | Coinbase CDP API key ID (uses Coinbase facilitator)              |
| `CDP_API_KEY_SECRET`   | Coinbase CDP API key secret                                      |
| `STRIPE_SECRET_KEY`    | Enable experimental Stripe payment adapter                       |
| `OPENAI_API_KEY`       | OpenAI API key (for agents using OpenAI models)                  |

## Examples

| Example              | Description                             |
| -------------------- | --------------------------------------- |
| `agent-boilerplate`  | Minimal starter (auto-generated server) |
| `agent-price-oracle` | CoinGecko price feeds                   |
| `agent-chainlink`    | Chainlink data feeds with custom server |
| `agent-job-hunter`   | Remote job search                       |
| `agent-travel`       | Flight search with Stripe payments      |

## Contributing

```bash
bun install
bun run dev
bun run format
```

## License

MIT
