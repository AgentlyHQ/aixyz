# Multi-Specialist Agent (Sub-Agents)

Demonstrates how to deploy multiple specialist agents from a single service using the `app/agents/` directory. Each file in `app/agents/` becomes an independent A2A endpoint alongside the main `app/agent.ts` coordinator.

This example has three agents:

- **Coordinator** (`app/agent.ts`) — routes users to the right specialist
- **Math specialist** (`app/agents/math.ts`) — performs arithmetic using the `calculate` tool
- **Text specialist** (`app/agents/text.ts`) — analyzes text using the `word-count` tool

## Quick Start

```bash
bun install

# Create .env.local with your keys
echo "OPENAI_API_KEY=sk-..." > .env.local

bun run dev
```

## Project Structure

```
app/
├── agent.ts            # Coordinator → /agent
├── agents/
│   ├── math.ts         # Math sub-agent → /math/agent
│   └── text.ts         # Text sub-agent → /text/agent
├── tools/
│   ├── calculate.ts    # Arithmetic (add/subtract/multiply/divide)
│   └── word-count.ts   # Text analysis (words/characters/sentences)
└── icon.png
```

## API Endpoints

A single deployment exposes three independent A2A endpoints:

| Endpoint                            | Description                |
| ----------------------------------- | -------------------------- |
| `/.well-known/agent-card.json`      | Coordinator discovery card |
| `POST /agent`                       | Coordinator JSON-RPC       |
| `/math/.well-known/agent-card.json` | Math agent discovery card  |
| `POST /math/agent`                  | Math agent JSON-RPC        |
| `/text/.well-known/agent-card.json` | Text agent discovery card  |
| `POST /text/agent`                  | Text agent JSON-RPC        |
| `POST /mcp`                         | Shared MCP tool endpoint   |

## Sub-Agent Pattern

Each file in `app/agents/` follows the same shape as `app/agent.ts`. The filename determines the URL prefix:

```typescript
// app/agents/math.ts  →  /math/agent
export const accepts: Accepts = { scheme: "exact", price: "$0.001" };
export default new ToolLoopAgent({ ... });
```

## Environment Variables

| Variable         | Description    |
| ---------------- | -------------- |
| `OPENAI_API_KEY` | OpenAI API key |

## Payment

Each agent charges `$0.001` per request via x402 on Base (mainnet in production, Base Sepolia in development).

## Build & Deploy

```bash
bun run build
vercel
```
