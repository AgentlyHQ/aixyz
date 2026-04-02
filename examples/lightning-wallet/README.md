# Lightning Wallet Agent

An aixyz agent with a Bitcoin Lightning wallet. Demonstrates how to give AI agents the ability to hold funds, make instant payments, access paid APIs via L402, and manage sub-agents with spending limits.

Uses [lightning-wallet-mcp](https://github.com/lightningfaucet/lightning-wallet-mcp) as the wallet backend.

## Quick Start

```bash
# Install the Lightning Wallet CLI
npm install -g lightning-wallet-mcp

# Register and set your API key
lw register --name "My aixyz Agent"
export LIGHTNING_WALLET_API_KEY=<your-key>

# Install dependencies and run
bun install

# Create .env.local with your keys
echo "OPENAI_API_KEY=sk-..." > .env.local
echo "LIGHTNING_WALLET_API_KEY=<your-key>" >> .env.local

bun run dev
```

## Project Structure

```
app/
├── agent.ts              # Agent definition with wallet instructions
├── icon.svg              # Lightning bolt icon
├── tools/
│   ├── lw.ts             # CLI wrapper for lightning-wallet-mcp
│   ├── check-balance.ts  # Check wallet balance and budget status
│   ├── send-payment.ts   # Pay Lightning invoices (BOLT11)
│   ├── pay-api.ts        # Access L402-protected paid APIs
│   ├── create-agent.ts   # Create sub-agents with spending limits
│   ├── fund-agent.ts     # Transfer sats to sub-agents
│   └── list-agents.ts    # List sub-agents and their balances
```

## Skills

| Skill | Example |
|-------|---------|
| Check Balance | "What's my balance?" |
| Send Payment | "Pay this invoice: lnbc100n1..." |
| Pay L402 API | "Get a fortune from https://lightningfaucet.com/api/l402/fortune" |
| Manage Agents | "Create a research agent with a 1000 sat budget" |

## How It Works

The agent wraps the `lw` CLI, which communicates with Lightning Faucet's wallet infrastructure:

1. **Balance** - Each agent has an isolated sat balance with optional daily spending limits
2. **Payments** - Pay any Lightning invoice instantly. Invoices are decoded first to confirm the amount
3. **L402 APIs** - When an API returns HTTP 402, the agent automatically pays the Lightning invoice in the challenge and retries with proof-of-payment
4. **Sub-Agents** - Create child agents with their own wallets and budgets for multi-agent workflows

## L402 Example

The L402 protocol lets APIs charge per-request using Lightning. The agent handles this transparently:

```
User: "Get me a fortune from the L402 API"
Agent: [calls payApi with URL]
  → GET https://lightningfaucet.com/api/l402/fortune
  ← 402 Payment Required (WWW-Authenticate: L402 invoice=lnbc...)
  → Pays invoice (1 sat)
  → GET with L402 token
  ← 200 OK {"fortune": "The best time to plant a tree was 20 years ago."}
Agent: "Here's your fortune: The best time to plant a tree was 20 years ago. Cost: 1 sat."
```

## Learn More

- [lightning-wallet-mcp](https://github.com/lightningfaucet/lightning-wallet-mcp) - The wallet MCP server and CLI
- [Lightning Faucet](https://lightningfaucet.com) - Free Bitcoin and agent wallet infrastructure
- [L402 Protocol](https://lightningfaucet.com/build) - Machine-to-machine payments over HTTP 402
