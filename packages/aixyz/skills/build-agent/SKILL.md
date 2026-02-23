---
name: build-agent
description: >-
  Build, run, and deploy an AI agent using the aixyz framework.
  Use this skill when creating a new agent, adding tools, wiring up A2A/MCP protocols,
  configuring x402 micropayments, or deploying to Vercel.
license: MIT
metadata:
  version: 1.0.0
  framework: aixyz
  runtime: bun
---

# Build an Agent with aixyz

## When to Use

Use this skill when:

- Scaffolding a new AI agent project from scratch
- Adding a new tool to an existing agent
- Configuring x402 micropayments for an agent or tool
- Wiring up A2A and MCP protocol endpoints
- Deploying an agent to Vercel

## Instructions

### 1. Scaffold a new project

```bash
bunx create-aixyz-app my-agent
cd my-agent
bun install
```

This creates the standard project layout:

```
my-agent/
  aixyz.config.ts     # Agent metadata and skills
  app/
    agent.ts          # Agent definition
    tools/            # One file per tool
  package.json
  vercel.json
```

### 2. Configure the agent (`aixyz.config.ts`)

Every agent needs a config file at the project root. Declare identity, payment address, and skills:

```ts
import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "My Agent",
  description: "A short description of what this agent does.",
  version: "0.1.0",
  x402: {
    payTo: process.env.X402_PAY_TO!,
    network: process.env.NODE_ENV === "production" ? "eip155:8453" : "eip155:84532",
  },
  skills: [
    {
      id: "my-skill",
      name: "My Skill",
      description: "What this skill does for callers.",
      tags: ["example"],
      examples: ["Do something with my skill"],
    },
  ],
};

export default config;
```

### 3. Write a tool (`app/tools/<name>.ts`)

Each file in `app/tools/` exports a Vercel AI SDK `tool` as its default export, plus an optional
`accepts` export to gate the tool behind an x402 payment:

```ts
import { tool } from "ai";
import { z } from "zod";
import type { Accepts } from "aixyz/accepts";

// Optional: require payment to call this tool via MCP
export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default tool({
  description: "A short description of what this tool does.",
  inputSchema: z.object({
    query: z.string().describe("Input to the tool"),
  }),
  execute: async ({ query }) => {
    // your logic here
    return { result: query };
  },
});
```

Files prefixed with `_` (e.g. `_helpers.ts`) are ignored by the auto-generated server.

### 4. Define the agent (`app/agent.ts`)

```ts
import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";
import myTool from "./tools/my-tool";

// Optional: require payment per A2A request
export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.005",
};

export default new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: "You are a helpful assistant.",
  tools: { myTool },
  stopWhen: stepCountIs(10),
});
```

### 5. Run the dev server

```bash
bun run dev      # aixyz dev — starts at http://localhost:3000 with hot reload
bun run dev -- -p 4000  # custom port
```

Endpoints served automatically:

| Endpoint                       | Protocol | Description                   |
| ------------------------------ | -------- | ----------------------------- |
| `/.well-known/agent-card.json` | A2A      | Agent discovery               |
| `/agent`                       | A2A      | JSON-RPC, x402 payment gate   |
| `/mcp`                         | MCP      | Tool sharing with MCP clients |

### 6. (Optional) Custom server (`app/server.ts`)

For full control, create `app/server.ts`. It takes precedence over auto-generation:

```ts
import { AixyzServer } from "aixyz/server";
import { useA2A } from "aixyz/server/adapters/a2a";
import { AixyzMCP } from "aixyz/server/adapters/mcp";
import * as agent from "./agent";
import myTool from "./tools/my-tool";

const server = new AixyzServer();
await server.initialize();
server.unstable_withIndexPage();

useA2A(server, agent);

const mcp = new AixyzMCP(server);
await mcp.register("myTool", {
  default: myTool,
  accepts: { scheme: "exact", price: "$0.001" },
});
await mcp.connect();

export default server;
```

### 7. Build and deploy to Vercel

```bash
bun run build    # aixyz build — outputs Vercel Build Output API v3 to .vercel/output/
vercel deploy
```

## Examples

Working examples in the repo: `examples/agent-boilerplate`, `examples/agent-price-oracle`.

## Common Edge Cases

- **Missing `x402.network`** — always provide `x402.network`; it has no fallback.
- **Missing `x402.payTo`** — set `X402_PAY_TO` in `.env.local` or provide it directly in config.
- **Tool file ignored** — files prefixed with `_` are excluded; rename to remove the prefix.
- **Agent card missing skills** — `skills` defaults to `[]`; add at least one entry to be discoverable.
- **Free endpoint** — export `accepts: { scheme: "free" }` to expose an endpoint without payment.
- **Port conflict in dev** — use `aixyz dev -p <port>` to change the default port (3000).
