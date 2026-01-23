# Agent Chainlink

An AI agent that provides real-time cryptocurrency price data using Chainlink price feeds on Ethereum mainnet.

## Features

- Real-time crypto price lookups via Chainlink oracles
- A2A (Agent-to-Agent) protocol support
- MCP (Model Context Protocol) support
- x402 payment integration
- Supports ETH, BTC, LINK, and other major cryptocurrencies

## Local Development

1. Install dependencies:

```bash
pnpm install
```

2. Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

3. Run in development mode:

```bash
pnpm run dev
```

The server will start on `http://localhost:3000`

## Deploying to Vercel

This project is configured to deploy to Vercel. Follow these steps:

1. Push your code to a GitHub repository

2. Connect your repository to Vercel:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository
   - Set the root directory to `examples/agent-chainlink`

3. Configure environment variables in Vercel:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `ALCHEMY_API_KEY`: Your Alchemy API key for Ethereum access
   - `AGENT_URL`: Your Vercel deployment URL (e.g., `https://your-app.vercel.app/`)
   - `X402_PAYMENT_ADDRESS`: Wallet address for receiving payments
   - `X402_NETWORK`: Payment network (default: `eip155:84532` for Base Sepolia)
   - `X402_AMOUNT`: Payment amount (default: `$0.000001`)
   - `X402_FACILITATOR_URL`: x402 facilitator URL (default: `https://facilitator.x402.org`)

4. Deploy! Vercel will automatically build and deploy your agent.

## Endpoints

Once deployed, your agent will be available at:

- Agent Card: `https://your-app.vercel.app/.well-known/agent-card.json`
- JSON-RPC: `https://your-app.vercel.app/` (POST)
- MCP: `https://your-app.vercel.app/mcp` (POST)

## Testing

Run tests:

```bash
pnpm run test
```
