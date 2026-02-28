---
name: aixyz
description: >-
  Build, run, and deploy an AI agent using the aixyz framework.
  Use this skill when creating a new agent, adding tools, wiring up A2A/MCP protocols,
  configuring x402 micropayments, or deploying to Vercel.
license: MIT
metadata:
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

All CLI commands support `--help` for full usage details. Use `--help` to discover available options.

```bash
# See all options
bunx create-aixyz-app --help

# Interactive (TTY)
bunx create-aixyz-app my-agent

# Non-interactive (recommended for AI/CI)
bunx create-aixyz-app my-agent --yes
bunx create-aixyz-app my-agent --erc-8004 --pay-to 0x... --no-install
```

> The scaffolded template uses `@ai-sdk/ollama` with `qwen2.5:1.5b` (a ~2GB local model) by default. Ensure
> [Ollama](https://ollama.com) is running locally and the model is pulled with `ollama pull qwen2.5:1.5b`. You can swap
> it for any [Vercel AI SDK provider adapter](https://ai-sdk.dev/docs/ai-sdk-core/providers-and-models)
> (e.g. `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`).

This creates the standard project layout:

```
my-agent/
  aixyz.config.ts     # Agent metadata and skills
  app/
    agent.ts          # Agent definition
    tools/            # One file per tool
    icon.png          # Agent icon (optional)
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

### 3. Payment: `accepts` export (`aixyz/accepts`)

Every agent and tool controls whether it requires payment by exporting `accepts` from `aixyz/accepts`.
Without this export, the endpoint is not registered for payment gating.

```ts
import type { Accepts } from "aixyz/accepts";

// Require x402 micropayment
export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001", // USD-denominated
  network: "eip155:8453", // optional — defaults to config.x402.network
  payTo: "0x...", // optional — defaults to config.x402.payTo
};

// Or make the endpoint free
export const accepts: Accepts = {
  scheme: "free",
};
```

Export `accepts` from `app/agent.ts` to gate the A2A endpoint, or from a tool file to gate that tool via MCP.

### 4. Write a tool (`app/tools/<name>.ts`)

Each file in `app/tools/` exports a Vercel AI SDK `tool` as its default export:

```ts
import { tool } from "ai";
import { z } from "zod";
import type { Accepts } from "aixyz/accepts";

export const accepts: Accepts = { scheme: "exact", price: "$0.001" };

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

### 5. Define the agent (`app/agent.ts`)

The default template uses `@ai-sdk/openai`, but you can use any [Vercel AI SDK provider adapter](https://ai-sdk.dev/docs/ai-sdk-core/providers-and-models):

```ts
// OpenAI (default in template)
import { openai } from "@ai-sdk/openai";

// Or swap the model provider — install the adapter and change the import:
// import { anthropic } from "@ai-sdk/anthropic";  // set ANTHROPIC_API_KEY
// import { google } from "@ai-sdk/google";        // set GOOGLE_GENERATIVE_AI_API_KEY

import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";
import myTool from "./tools/my-tool";

export const accepts: Accepts = { scheme: "exact", price: "$0.005" };

export default new ToolLoopAgent({
  model: openai("gpt-4o-mini"), // replace with anthropic("claude-..."), google("gemini-..."), etc.
  instructions: "You are a helpful assistant.",
  tools: { myTool },
  stopWhen: stepCountIs(10),
});
```

### 5a. Add sub-agents (`app/agents/<name>.ts`)

Place additional agent files in `app/agents/` to expose multiple independent A2A endpoints from one deployment.
Each filename becomes a URL prefix:

```
app/
  agent.ts           # → /agent  (main)
  agents/
    math.ts          # → /math/agent
    text.ts          # → /text/agent
```

Each sub-agent file has the same structure as `app/agent.ts`:

```ts
import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";
import calculate from "../tools/calculate";

export const accepts: Accepts = { scheme: "exact", price: "$0.001" };

export default new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: "You are a math specialist. Use the calculate tool for arithmetic.",
  tools: { calculate },
  stopWhen: stepCountIs(5),
});
```

Sub-agents share the same `/mcp` endpoint for tools and each get their own agent card:

- `/math/.well-known/agent-card.json`
- `/math/agent`

See `examples/agent-with-sub-agents` for a working example with a coordinator + two specialists.

### 6. Environment variables (`.env` files)

Environment variables are loaded in the same priority order as Next.js:

1. `.env.<NODE_ENV>.local` (highest priority; not loaded when `NODE_ENV=test`)
2. `.env.local`
3. `.env.<NODE_ENV>` (e.g. `.env.production`, `.env.development`)
4. `.env`

Common variables:

| Variable               | Description                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| `X402_PAY_TO`          | Default EVM address to receive payments                                      |
| `X402_NETWORK`         | Default payment network (e.g. `eip155:8453`)                                 |
| `X402_FACILITATOR_URL` | Custom facilitator URL (default: `https://x402.use-agently.com/facilitator`) |
| `OLLAMA_BASE_URL`      | Ollama server base URL (default: `http://127.0.0.1:11434/api`)               |

### 7. Agent icon (`app/icon.png`)

Place an icon file at `app/icon.png` (also accepts `.svg`, `.jpeg`, `.jpg`). During `aixyz build` it is:

- Copied to the output as `icon.png`
- Converted to a `favicon.ico` (32×32) and placed in `public/`

No configuration needed — the build step auto-detects and processes the icon.

### 8. Custom facilitator (`app/accepts.ts`)

By default, aixyz uses `https://x402.use-agently.com/facilitator` to verify payments. To use a different
facilitator, create `app/accepts.ts` and export a `facilitator`:

```ts
import { HTTPFacilitatorClient } from "aixyz/accepts";

export const facilitator = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL ?? "https://www.x402.org/facilitator",
});
```

### 9. Run the dev server

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

### 10. (Optional) Custom server (`app/server.ts`)

For full control, create `app/server.ts`. It takes precedence over auto-generation.
The `accepts` field in `mcp.register` is optional — omit it to expose the tool without payment gating:

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
  // accepts is optional — omit to expose without payment
  accepts: { scheme: "exact", price: "$0.001" },
});
await mcp.connect();

export default server;
```

### 11. Build and deploy to Vercel

```bash
bun run build    # aixyz build — outputs Vercel Build Output API v3 to .vercel/output/
vercel deploy
```

## Examples

Working examples in the repo: `examples/agent-boilerplate`, `examples/agent-price-oracle`,
`examples/agent-byo-facilitator`, `examples/agent-with-sub-agents`.

## Common Dependencies

A scaffolded agent project uses these key packages:

| Package           | Purpose                                                          |
| ----------------- | ---------------------------------------------------------------- |
| `aixyz`           | Framework core: server, adapters (A2A, MCP), x402 payment gating |
| `ai`              | Vercel AI SDK v6 — `ToolLoopAgent`, `tool()`, `stepCountIs()`    |
| `@ai-sdk/openai`  | Default model adapter (swap for any AI SDK provider adapter)     |
| `zod`             | Schema validation for tool inputs (`z.object`, `z.string`, etc.) |
| `@aixyz/erc-8004` | ERC-8004 Agent Identity (optional, added with `--erc-8004`)      |

To use a different LLM provider, install its AI SDK adapter and update the import in `app/agent.ts`:

```bash
bun add @ai-sdk/anthropic   # Anthropic Claude
bun add @ai-sdk/google      # Google Gemini
bun add @ai-sdk/amazon-bedrock  # AWS Bedrock
```

See the [Vercel AI SDK providers](https://ai-sdk.dev/docs/ai-sdk-core/providers-and-models) for the full list.

## Common Edge Cases

- **Missing `x402.network`** — always provide `x402.network`; it has no fallback.
- **Missing `x402.payTo`** — set `X402_PAY_TO` in `.env.local` or provide it directly in config.
- **Tool file ignored** — files prefixed with `_` are excluded; rename to remove the prefix.
- **Agent card missing skills** — `skills` defaults to `[]`; add at least one entry to be discoverable.
- **Free endpoint** — export `accepts: { scheme: "free" }` to expose an endpoint without payment.
- **Port conflict in dev** — use `aixyz dev -p <port>` to change the default port (3000).

## CLI Reference (Non-TTY / AI-Friendly)

All CLI commands are designed for non-interactive use. When `stdin` is not a TTY, prompts are skipped — values come from CLI flags, environment variables, or sensible defaults. Use `--help` on any command for full usage.

### `create-aixyz-app`

```bash
bunx create-aixyz-app --help
```

| Flag                      | Description                             | Default                                      |
| ------------------------- | --------------------------------------- | -------------------------------------------- |
| `[name]`                  | Agent name (positional argument)        | `my-agent`                                   |
| `-y, --yes`               | Use all defaults, skip prompts          |                                              |
| `--erc-8004`              | Include ERC-8004 Agent Identity support | `false`                                      |
| `--ollama-base-url <url>` | Ollama base URL for `.env.local`        | `http://127.0.0.1:11434/api`                 |
| `--pay-to <address>`      | x402 payTo Ethereum address             | `0x0799872E07EA7a63c79357694504FE66EDfE4a0A` |
| `--no-install`            | Skip `bun install`                      |                                              |

### `aixyz dev` / `aixyz build`

```bash
aixyz dev --help
aixyz build --help
```

### `aixyz erc-8004 register`

```bash
aixyz erc-8004 register --help
```

| Flag                       | Description                           | Required in non-TTY |
| -------------------------- | ------------------------------------- | ------------------- |
| `--url <url>`              | Agent deployment URL                  | Yes                 |
| `--chain-id <id>`          | Target chain numeric ID               | Yes                 |
| `--supported-trust <list>` | Comma-separated trust mechanisms      | If no erc-8004.ts   |
| `--keystore <path>`        | Keystore file path                    | One of keystore,    |
| `--browser`                | Use browser wallet                    | browser, or         |
| `PRIVATE_KEY` env          | Private key for signing               | PRIVATE_KEY         |
| `--broadcast`              | Execute on-chain (default is dry-run) | No                  |
| `--rpc-url <url>`          | Custom RPC endpoint                   | For custom chains   |
| `--registry <address>`     | Registry contract address             | For custom chains   |
| `--out-dir <path>`         | Write result JSON to directory        | No                  |

### `aixyz erc-8004 update`

```bash
aixyz erc-8004 update --help
```

| Flag                   | Description                           | Required in non-TTY       |
| ---------------------- | ------------------------------------- | ------------------------- |
| `--url <url>`          | New agent deployment URL              | Yes                       |
| `--agent-id <id>`      | Agent ID to update                    | If multiple registrations |
| `--keystore <path>`    | Keystore file path                    | One of keystore,          |
| `--browser`            | Use browser wallet                    | browser, or               |
| `PRIVATE_KEY` env      | Private key for signing               | PRIVATE_KEY               |
| `--broadcast`          | Execute on-chain (default is dry-run) | No                        |
| `--rpc-url <url>`      | Custom RPC endpoint                   | For custom chains         |
| `--registry <address>` | Registry contract address             | For localhost only        |
| `--out-dir <path>`     | Write result JSON to directory        | No                        |
