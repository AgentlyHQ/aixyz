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

# Working with aixyz

## Where to Find the Latest Information

The project evolves quickly. **Always consult these sources for up-to-date details:**

- **Docs site:** [aixyz.sh](https://aixyz.sh) — Getting Started guides, API reference, protocol docs, and templates
- **GitHub:** [github.com/AgentlyHQ/aixyz](https://github.com/AgentlyHQ/aixyz) — source, issues, and examples
- **CLI help:** every command has `--help` — run it to discover the current flags

## Immutable Facts

These things will not change:

- **Runtime is always Bun** — install with `bun`, run with `bun`, test with `bun test`
- **Agent logic uses the Vercel AI SDK** (`ai` package) — `ToolLoopAgent`, `tool()`, `stepCountIs()` from `"ai"` — check [ai-sdk.dev](https://ai-sdk.dev) for the current version
- **LLM providers use `@ai-sdk/*` adapters** — `@ai-sdk/openai` is the default but any Vercel AI SDK provider works (`@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/amazon-bedrock`, etc.)
- **`create-aixyz-app` is always available** for scaffolding — use `bunx create-aixyz-app --help` to see all options
- **`aixyz` CLI is always available** — `aixyz dev` for the dev/test loop, `aixyz build` for building
- **Environment variables follow Next.js load order** — `.env`, `.env.local` (don't commit), `.env.<NODE_ENV>`, `.env.<NODE_ENV>.local`

## Getting Started

```bash
# See all scaffolding options (TTY is disabled in AI/CI — every prompt has a flag)
bunx create-aixyz-app --help

# Scaffold with defaults
bunx create-aixyz-app my-agent --yes

# Dev/test loop
cd my-agent && bun run dev   # aixyz dev — hot reload at http://localhost:3000

# Build for deployment
bun run build                # aixyz build
```

## Core Concepts

### Project layout

```
my-agent/
  aixyz.config.ts       # Agent identity, payment config, skills declaration
  app/
    agent.ts            # Main agent (ToolLoopAgent from "ai")
    agent.test.ts       # Tests (bun:test)
    agents/             # Sub-agents — each file → its own /name/agent endpoint
    tools/              # Tools — each file auto-registered; _prefix files ignored
    server.ts           # Optional: custom server (overrides auto-generation)
    accepts.ts          # Optional: custom x402 facilitator
    erc-8004.ts         # Optional: on-chain ERC-8004 identity
    icon.png            # Optional: agent icon
  package.json
  vercel.json
  .env.local            # API keys — never commit
```

### Getting paid (x402)

Export `accepts` from `app/agent.ts` (gates `/agent`) or from a tool file (gates it on `/mcp`):

```ts
import type { Accepts } from "aixyz/accepts";

export const accepts: Accepts = { scheme: "exact", price: "$0.005" };
```

No `accepts` export → endpoint is not payment-gated. `scheme: "free"` → explicitly free.
See [aixyz.sh/getting-started/payments](https://aixyz.sh/getting-started/payments) for full details.

### On-chain identity (ERC-8004)

Register your agent on-chain with:

```bash
aixyz erc-8004 register --help   # see all non-TTY flags
aixyz erc-8004 register --url https://my-agent.vercel.app --broadcast
```

See [aixyz.sh/protocols/erc-8004](https://aixyz.sh/protocols/erc-8004) for full details.

### Testing

Tests use Bun's built-in runner (`bun:test`). Write deterministic tests (no API calls) and use
`test.skipIf(!process.env.OPENAI_API_KEY)` for non-deterministic ones. Use `fake()` from `"aixyz/model"` for
fully offline CI-safe tests.

```bash
bun test                      # run all tests
bun test app/agent.test.ts    # run a specific file
```

See [aixyz.sh/getting-started/testing](https://aixyz.sh/getting-started/testing) for full details.

## Protocol Endpoints

Every deployed agent exposes these endpoints automatically:

| Endpoint                       | Protocol | Description                              |
| ------------------------------ | -------- | ---------------------------------------- |
| `/.well-known/agent-card.json` | A2A      | Agent discovery card                     |
| `/agent`                       | A2A      | JSON-RPC endpoint with x402 payment gate |
| `/mcp`                         | MCP      | Tool sharing with MCP clients            |

## Examples

The `examples/` directory in [github.com/AgentlyHQ/aixyz](https://github.com/AgentlyHQ/aixyz) contains
working agents for common patterns. **When in doubt, find an example that matches what you need.**

If you have GitHub access, clone the repo and explore `examples/` directly:

```bash
gh repo clone AgentlyHQ/aixyz
ls aixyz/examples/
```

Each example has an `aixyz.config.ts`, `app/agent.ts`, and `app/tools/` you can learn from.
The [Templates tab on aixyz.sh](https://aixyz.sh/templates/overview) documents each example.

## Repo Structure (for exploration)

If you clone the repo, the key areas are:

```
packages/
  aixyz/              # Framework core (server, adapters, x402)
  aixyz-cli/          # CLI: dev, build, erc-8004 commands
  aixyz-config/       # Config loading (Zod-validated aixyz.config.ts)
  aixyz-erc-8004/     # ERC-8004 ABIs, addresses, schemas
  create-aixyz-app/   # Scaffolding CLI
docs/                 # Mintlify docs (run `mint dev` to preview)
examples/             # Working agent examples
```

Use `--help` on any CLI command, read the docs at [aixyz.sh](https://aixyz.sh), or browse examples in
[github.com/AgentlyHQ/aixyz/tree/main/examples](https://github.com/AgentlyHQ/aixyz/tree/main/examples)
for the most current information.
