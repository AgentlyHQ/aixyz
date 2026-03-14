# Job Hunter — Career Scout Agent

An AI agent that searches for remote job opportunities worldwide using the [Jobicy API](https://jobicy.com/api). Demonstrates integrating an external REST API with an aixyz agent gated behind x402 payments.

## Quick Start

```bash
bun install

# Create .env.local with your keys
cat > .env.local <<EOF
OPENAI_API_KEY=sk-...
X402_PAY_TO=0xYourAddress
X402_NETWORK=eip155:84532
EOF

bun run dev
```

## Project Structure

```
app/
├── agent.ts        # Agent with remote job search tool
├── tools/
│   └── search.ts   # Jobicy API integration
└── icon.png
```

## Skills

| Skill             | Example                               |
| ----------------- | ------------------------------------- |
| Remote Job Search | "Find remote jobs in Canada"          |
|                   | "What positions are available in UK?" |

## Environment Variables

| Variable         | Description                            |
| ---------------- | -------------------------------------- |
| `OPENAI_API_KEY` | OpenAI API key                         |
| `X402_PAY_TO`    | Payment destination address            |
| `X402_NETWORK`   | Payment network (e.g., `eip155:84532`) |

## API Endpoints

| Endpoint                       | Description           |
| ------------------------------ | --------------------- |
| `/.well-known/agent-card.json` | A2A agent card        |
| `POST /agent`                  | A2A JSON-RPC endpoint |
| `POST /mcp`                    | MCP tool endpoint     |

## Payment

Charges `$0.01` per request via x402. Payment destination is configured via environment variables.

## Build & Deploy

```bash
bun run build
vercel
```
