# NetIntel Network Intelligence Agent

A network intelligence agent powered by NetIntel x402 APIs. Extract structured data from unstructured text, look up DNS records, analyze SSL certificates, and validate email authentication — all pay-per-call via x402 on Base mainnet.

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
├── agent.ts            # Agent definition with all four tools
├── tools/
│   ├── schema-parse.ts # Extract structured data from unstructured text
│   ├── dns-lookup.ts   # Look up DNS records for a domain
│   ├── ssl-analyze.ts  # Analyze TLS/SSL certificates and security
│   └── email-auth.ts   # Validate SPF, DKIM, and DMARC records
```

## Skills

| Skill                       | Example                                         |
| --------------------------- | ----------------------------------------------- |
| Structured Data Extraction  | "Extract contact info from this email signature" |
| DNS Lookup                  | "Look up DNS records for example.com"            |
| SSL Analysis                | "Check SSL certificate for github.com"           |
| Email Authentication        | "Check email security for gmail.com"             |

## Environment Variables

| Variable         | Description    |
| ---------------- | -------------- |
| `OPENAI_API_KEY` | OpenAI API key |

## API Endpoints

| Endpoint                       | Description           |
| ------------------------------ | --------------------- |
| `/.well-known/agent-card.json` | A2A agent card        |
| `POST /agent`                  | A2A JSON-RPC endpoint |
| `POST /mcp`                    | MCP tool endpoint     |

## Payment

Charges `$0.005` per request via x402 on Base (mainnet in production, Base Sepolia in development). NetIntel endpoints are pay-per-call via x402 on Base mainnet.

## Build & Deploy

```bash
bun run build   # bundle for deployment
vercel          # deploy to Vercel
```
