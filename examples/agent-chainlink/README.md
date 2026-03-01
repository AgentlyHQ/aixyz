# Chainlink Price Oracle Agent

Provides real-time cryptocurrency price data by reading [Chainlink price feeds](https://data.chain.link) directly from Ethereum mainnet. Demonstrates on-chain data integration with an aixyz agent gated behind x402 payments.

## Quick Start

```bash
bun install

# Create .env.local with your keys
cat > .env.local <<EOF
OPENAI_API_KEY=sk-...
X402_PAY_TO=0xYourAddress
X402_NETWORK=eip155:8453
EOF

bun run dev
```

## Project Structure

```
app/
├── agent.ts        # Agent with Chainlink price lookup tool
├── tools/
│   └── lookup.ts   # Reads Chainlink price feeds on Ethereum mainnet
└── icon.png
```

## Skills

| Skill                  | Example                             |
| ---------------------- | ----------------------------------- |
| Chainlink Price Lookup | "What is the current price of ETH?" |
|                        | "Look up the price of BTC"          |
|                        | "Get me the latest LINK price"      |

## Environment Variables

| Variable         | Description                           |
| ---------------- | ------------------------------------- |
| `OPENAI_API_KEY` | OpenAI API key                        |
| `X402_PAY_TO`    | Payment destination address           |
| `X402_NETWORK`   | Payment network (e.g., `eip155:8453`) |

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
