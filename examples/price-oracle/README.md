# Price Gecky — Price Oracle Agent

A cryptocurrency market data agent powered by the [CoinGecko Pro API](https://www.coingecko.com/en/api). Supports token price lookups, newly listed token discovery, and top gainers/losers — all gated behind x402 micropayments.

## Quick Start

```bash
bun install

# Create .env.local with your keys
cat > .env.local <<EOF
OPENAI_API_KEY=sk-...
COINGECKO_API_KEY=CG-...
EOF

bun run dev
```

## Project Structure

```
app/
├── agent.ts                        # Agent with three market data tools
├── tools/
│   ├── getTokenPrice.ts            # Token price lookup
│   ├── getNewListedTokens.ts       # Newly listed token discovery
│   └── getTopGainersLosers.ts      # Top gainers and losers
├── utils/                          # Shared CoinGecko API utilities
└── icon.png
```

## Skills

| Skill                | Example                           |
| -------------------- | --------------------------------- |
| Token Price Lookup   | "What is the price of Bitcoin?"   |
| Newly Listed Tokens  | "Show me new tokens"              |
| Top Gainers & Losers | "What are the top gainers today?" |

## Environment Variables

| Variable            | Description           |
| ------------------- | --------------------- |
| `OPENAI_API_KEY`    | OpenAI API key        |
| `COINGECKO_API_KEY` | CoinGecko Pro API key |

## API Endpoints

| Endpoint                       | Description           |
| ------------------------------ | --------------------- |
| `/.well-known/agent-card.json` | A2A agent card        |
| `POST /agent`                  | A2A JSON-RPC endpoint |
| `POST /mcp`                    | MCP tool endpoint     |

## Payment

Charges `$0.01` per request via x402 on Base (mainnet in production, Base Sepolia in development).

## Build & Deploy

```bash
bun run build
vercel
```
