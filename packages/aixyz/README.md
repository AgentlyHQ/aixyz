# aixyz

[![npm](https://img.shields.io/npm/v/aixyz)](https://www.npmjs.com/package/aixyz)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Bundle AI agents from any framework into deployable services. A2A, MCP, x402 payments, and ERC-8004 identity get wired
up for you.

## Quickstart

```bash
pnpm create aixyz-app my-agent
cd my-agent
pnpm install
```

Add an `aixyz.config.ts`:

```ts
import type { AixyzConfig } from "aixyz";

const config: AixyzConfig = {
  name: "My Agent",
  description: "What your agent does in one sentence.",
  version: "1.0.0",
  network: "eip155:1",
  x402: {
    payTo: process.env.X402_PAY_TO!,
    network: "eip155:8453",
  },
  skills: [
    {
      id: "my-skill",
      name: "My Skill",
      description: "Describe what this skill does",
      tags: ["example"],
    },
  ],
};

export default config;
```

Write your agent with whichever framework you prefer, then wire it up through an adapter:

```ts
// src/agent.ts
import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import myTool from "./tools/my-tool";

export const agent = new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: "You are a helpful agent that...",
  tools: { myTool },
  stopWhen: stepCountIs(10),
});
```

```ts
// src/index.ts
import { AixyzRequestHandler, initExpressApp, loadAixyzConfig } from "aixyz";
import { ToolLoopAgentExecutor } from "aixyz/server/adapters/ai";
import { InMemoryTaskStore } from "@a2a-js/sdk/server";
import { agent } from "./agent";

const config = loadAixyzConfig();
const handler = new AixyzRequestHandler(new InMemoryTaskStore(), new ToolLoopAgentExecutor(agent));

const x402Routes = {
  "POST /agent": {
    accepts: { scheme: "exact", price: "$0.01", network: config.x402.network, payTo: config.x402.payTo },
    mimeType: "application/json",
    description: "Payment for agent API access",
  },
};

export default await initExpressApp(handler, x402Routes);
```

```bash
bun run dev
```

This gives you:

| Endpoint                       | Protocol | Description                    |
| ------------------------------ | -------- | ------------------------------ |
| `/.well-known/agent-card.json` | A2A      | Agent discovery metadata       |
| `/agent`                       | A2A      | JSON-RPC endpoint (x402-gated) |
| `/mcp`                         | MCP      | Tool sharing                   |

## CLI

```bash
aixyz init          # Scaffold a new agent project
aixyz build         # Bundle for deployment
aixyz deploy        # Deploy
aixyz register      # Register on-chain (ERC-8004)
```

`aixyz build` loads your `aixyz.config.ts`, detects the entrypoint (`src/index.ts` or `src/app.ts`), bundles with
`Bun.build()` targeting Node.js, and outputs Vercel Build Output API v3 structure.

`aixyz register` creates an ERC-8004 on-chain identity for your agent so other agents and contracts can reference it.

## Adapters

Each adapter wraps a framework's agent into the `AgentExecutor` interface that aixyz needs to handle protocol requests.

| Adapter                  | Framework     | Import                            |
| ------------------------ | ------------- | --------------------------------- |
| `ToolLoopAgentExecutor`  | Vercel AI SDK | `aixyz/server/adapters/ai`        |
| `LangChainAgentExecutor` | LangChain     | `aixyz/server/adapters/langchain` |
| `MastraAgentExecutor`    | Mastra        | `aixyz/server/adapters/mastra`    |

If your framework isn't listed, implement `AgentExecutor` directly. It's one method.

## Project Structure

```
my-agent/
  aixyz.config.ts     # Agent config
  src/
    index.ts          # Entrypoint (adapter + express app)
    agent.ts          # Agent definition
    tools/
      my-tool.ts      # Tools
  public/             # Static assets (optional)
  package.json
  tsconfig.json
```

## Configuration

| Field          | Type               | Required | Description                                                          |
| -------------- | ------------------ | -------- | -------------------------------------------------------------------- |
| `name`         | `string`           | Yes      | Display name                                                         |
| `description`  | `string`           | Yes      | What your agent does                                                 |
| `version`      | `string`           | Yes      | Semver version                                                       |
| `network`      | `eip155:${number}` | Yes      | Chain ID for identity (e.g. `eip155:1`)                              |
| `url`          | `string`           | No       | Base URL. Auto-detected on Vercel, defaults to `localhost:3000`      |
| `x402.payTo`   | `string`           | Yes      | Payment recipient address. Falls back to `process.env.X402_PAY_TO`   |
| `x402.network` | `string`           | No       | Payment network (e.g. `eip155:8453` for Base). Defaults to `network` |
| `skills`       | `AgentSkill[]`     | Yes      | Skills your agent exposes                                            |

## Protocols

**A2A** generates your agent card and JSON-RPC endpoint so other agents can discover and talk to yours.

**MCP** exposes your tools to any MCP-compatible client.

**x402** gates requests behind HTTP 402 micropayments. No custodial wallets, no subscriptions.

**ERC-8004** gives your agent a verifiable on-chain identity on supported chains (i.e. Ethereum, Base, etc.)

## Contributing

```bash
bun install
bun run dev
bun run format  # before committing
```

## License

MIT
