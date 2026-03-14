# Unit Conversion Agent (Boilerplate)

The simplest starting point for an aixyz agent. Demonstrates a multi-skill agent with three unit conversion tools — length, weight, and temperature — using the auto-generated server pattern.

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
├── agent.ts            # Agent definition with all three tools
├── tools/
│   ├── length.ts       # Converts between metric and imperial lengths
│   ├── weight.ts       # Converts between metric and imperial weights
│   └── temperature.ts  # Converts between Celsius, Fahrenheit, and Kelvin
└── icon.png
```

## Skills

| Skill               | Example                          |
| ------------------- | -------------------------------- |
| Convert Length      | "Convert 100 meters to feet"     |
| Convert Weight      | "Convert 70 kilograms to pounds" |
| Convert Temperature | "Convert 100°C to Fahrenheit"    |

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

Charges `$0.001` per request via x402 on Base (mainnet in production, Base Sepolia in development).

## Build & Deploy

```bash
bun run build   # bundle for deployment
vercel          # deploy to Vercel
```
