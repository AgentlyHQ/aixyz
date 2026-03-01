# BYO Facilitator Agent

Demonstrates how to use a custom x402 payment facilitator via `app/accepts.ts`. Instead of the default `x402.org` facilitator, you can point to any x402-compatible service for payment verification.

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
├── agent.ts            # Agent with temperature conversion tool
├── accepts.ts          # Custom facilitator configuration
└── tools/
    └── temperature.ts  # Temperature conversion tool
```

## How It Works

`app/accepts.ts` points to a custom facilitator URL:

```typescript
import { HTTPFacilitatorClient } from "aixyz/accepts";

export const facilitator = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL ?? "https://www.x402.org/facilitator",
});
```

The build pipeline automatically picks up `app/accepts.ts` — no custom `server.ts` needed.

## Environment Variables

| Variable               | Description                                   |
| ---------------------- | --------------------------------------------- |
| `OPENAI_API_KEY`       | OpenAI API key                                |
| `X402_FACILITATOR_URL` | Custom facilitator URL (defaults to x402.org) |

## API Endpoints

| Endpoint                       | Description           |
| ------------------------------ | --------------------- |
| `/.well-known/agent-card.json` | A2A agent card        |
| `POST /agent`                  | A2A JSON-RPC endpoint |
| `POST /mcp`                    | MCP tool endpoint     |

## Payment

Charges `$0.005` per request via x402 on Base Sepolia.

## Build & Deploy

```bash
bun run build
vercel
```
