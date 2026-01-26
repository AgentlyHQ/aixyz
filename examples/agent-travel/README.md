# Travel Agent - Flight Search

An AI-powered travel agent that finds the cheapest flights between multiple departure airports and destinations worldwide using real-time pricing data.

## Features

- Search for roundtrip or one-way flights
- Compare prices across multiple departure airports
- Find flights to multiple destinations simultaneously
- Filter by minimum trip length
- Support multiple currencies (USD, EUR, BRL, etc.)
- Get discount information compared to average prices
- Direct booking links to Skyscanner

## Quick Start

```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Edit .env with your OPENAI_API_KEY

# Start development server
bun run dev
```

## Environment Variables

| Variable               | Description                     | Default                          |
| ---------------------- | ------------------------------- | -------------------------------- |
| `OPENAI_API_KEY`       | OpenAI API key for GPT-4o-mini  | Required                         |
| `PORT`                 | Server port                     | 3000                             |
| `AGENT_URL`            | Public URL of the agent         | http://localhost:3000/           |
| `X402_AMOUNT`          | Payment amount per request      | $0.001                           |
| `X402_NETWORK`         | Blockchain network for payments | eip155:84532                     |
| `X402_PAYMENT_ADDRESS` | Address to receive payments     | -                                |
| `X402_FACILITATOR_URL` | x402 facilitator URL            | https://www.x402.org/facilitator |

## API Endpoints

| Endpoint                       | Description                           |
| ------------------------------ | ------------------------------------- |
| `/.well-known/agent-card.json` | A2A agent card metadata               |
| `POST /`                       | JSON-RPC endpoint for A2A protocol    |
| `POST /mcp`                    | MCP (Model Context Protocol) endpoint |

## Usage Examples

### Using the Agent (A2A Protocol)

```bash
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"kind": "text", "text": "Find me cheap flights from Sao Paulo to Europe"}]
      }
    },
    "id": 1
  }'
```

### Using the Tool Directly (MCP Protocol)

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "searchFlights",
      "arguments": {
        "departures": ["GRU", "CWB"],
        "destinations": ["LHR", "CDG", "AMS", "FRA"],
        "currency": "USD",
        "tripType": "roundtrip",
        "minTripLength": 7
      }
    },
    "id": 1
  }'
```

## Tool: searchFlights

### Input Parameters

| Parameter       | Type     | Required | Default              | Description                     |
| --------------- | -------- | -------- | -------------------- | ------------------------------- |
| `departures`    | string[] | Yes      | -                    | Array of departure IATA codes   |
| `destinations`  | string[] | No       | Popular destinations | Array of destination IATA codes |
| `language`      | string   | No       | "en-US"              | Response language               |
| `currency`      | string   | No       | "USD"                | Price currency                  |
| `tripType`      | string   | No       | "roundtrip"          | "roundtrip" or "oneway"         |
| `minTripLength` | number   | No       | 5                    | Minimum trip length in days     |
| `startDate`     | string   | No       | null                 | Start date (YYYY-MM-DD)         |
| `endDate`       | string   | No       | null                 | End date (YYYY-MM-DD)           |

### Response Fields

Each flight result includes:

| Field                | Description                        |
| -------------------- | ---------------------------------- |
| `departureCode`      | IATA code of departure airport     |
| `departingAirport`   | Full name of departure airport     |
| `destinationCode`    | IATA code of destination           |
| `destinationAirport` | Full name of destination           |
| `price`              | Flight price in specified currency |
| `link`               | Direct booking link                |
| `discount`           | Discount % from average price      |
| `goDate`             | Departure date                     |
| `backDate`           | Return date                        |
| `tripLength`         | Trip length in days                |
| `avgMonth`           | Average monthly price              |
| `analyzedFares`      | Number of fares analyzed           |

## Popular IATA Codes

| Code | Airport                |
| ---- | ---------------------- |
| GRU  | Sao Paulo, Brazil      |
| CWB  | Curitiba, Brazil       |
| LAX  | Los Angeles, USA       |
| JFK  | New York, USA          |
| LHR  | London, UK             |
| CDG  | Paris, France          |
| AMS  | Amsterdam, Netherlands |
| FRA  | Frankfurt, Germany     |
| IST  | Istanbul, Turkey       |
| SIN  | Singapore              |
| HND  | Tokyo, Japan           |
| SYD  | Sydney, Australia      |

## Development

```bash
# Build
bun run build

# Test
bun run test

# Start production server
bun run start
```

## Deployment

### Vercel

This agent is ready for Vercel deployment:

```bash
vercel
```

### Docker

```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production
COPY . .
RUN bun run build
EXPOSE 3000
CMD ["bun", "run", "start"]
```

## License

MIT
