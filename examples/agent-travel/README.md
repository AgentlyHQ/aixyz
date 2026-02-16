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
- **Dual payment support**: x402 (crypto) and Stripe (credit card)

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

| Variable                 | Description                        | Default                          |
| ------------------------ | ---------------------------------- | -------------------------------- |
| `OPENAI_API_KEY`         | OpenAI API key for GPT-4o-mini     | Required                         |
| `PORT`                   | Server port                        | 3000                             |
| `AGENT_URL`              | Public URL of the agent            | http://localhost:3000/           |
| **x402 (Crypto)**        |                                    |                                  |
| `X402_PAY_TO`            | Address to receive payments        | Required                         |
| `X402_NETWORK`           | Blockchain network for payments    | eip155:84532                     |
| `X402_FACILITATOR_URL`   | x402 facilitator URL               | https://www.x402.org/facilitator |
| **Stripe (Credit Card)** |                                    |                                  |
| `STRIPE_SECRET_KEY`      | Stripe secret key (enables Stripe) | -                                |
| `STRIPE_PRICE_CENTS`     | Price per request in cents         | 100                              |

## API Endpoints

| Endpoint                             | Auth    | Description                               |
| ------------------------------------ | ------- | ----------------------------------------- |
| `/.well-known/agent-card.json`       | Public  | A2A agent card metadata                   |
| `POST /stripe/create-payment-intent` | Public  | Create PaymentIntent for client-side flow |
| `POST /agent`                        | Payment | JSON-RPC endpoint for A2A protocol        |
| `POST /mcp`                          | Payment | MCP (Model Context Protocol) endpoint     |

## Payment Methods

This agent supports two payment methods. Protected endpoints require one of these:

### Option 1: x402 (Cryptocurrency)

Pay with USDC on Base network. Include the payment proof in the header:

```bash
curl -X POST http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -H "X-Payment: <x402-payment-proof>" \
  -d '{"jsonrpc": "2.0", "method": "message/send", ...}'
```

### Option 2: Stripe (Credit Card)

Pay with credit card via Stripe Elements. Each payment is **single-use** (one payment = one API request).

#### Payment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT                                  │
│  1. POST /stripe/create-payment-intent → get clientSecret      │
│  2. Render <PaymentElement /> with clientSecret                │
│  3. User enters card details and clicks Pay                    │
│  4. stripe.confirmPayment() → paymentIntent.id                 │
│  5. Store paymentIntent.id for API call                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ X-Stripe-Payment-Intent-Id: pi_xxx
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                 │
│  1. Receive PaymentIntent ID in header                         │
│  2. Validate: status === "succeeded"                           │
│  3. Validate: amount >= expected price                         │
│  4. Validate: metadata.expected_amount exists (our system)     │
│  5. Check: metadata.consumed !== "true"                        │
│  6. Mark consumed & allow API access                           │
└─────────────────────────────────────────────────────────────────┘
```

#### Security Features

| Protection              | Description                                             |
| ----------------------- | ------------------------------------------------------- |
| **Amount verification** | Rejects PaymentIntents with amount less than configured |
| **Origin verification** | Only accepts PaymentIntents created by this backend     |
| **Single-use**          | Each PaymentIntent can only be used for one API request |
| **Stripe validation**   | All PaymentIntents are verified against Stripe's API    |

#### Quick Start

```bash
# 1. Create a PaymentIntent (returns clientSecret for frontend)
curl -X POST http://localhost:3000/stripe/create-payment-intent
# Returns: {"clientSecret": "pi_xxx_secret_xxx", "paymentIntentId": "pi_xxx"}

# 2. Use clientSecret with Stripe.js to render PaymentElement and confirm payment

# 3. Use PaymentIntent ID for your API request
curl -X POST http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -H "X-Stripe-Payment-Intent-Id: pi_xxx" \
  -d '{"jsonrpc": "2.0", "method": "message/send", ...}'
```

### Client-Side Implementation (React)

Install the required packages:

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

Here's a complete React example using Stripe Elements:

```tsx
import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

// Initialize Stripe with your publishable key
const stripePromise = loadStripe("pk_test_xxx");

// API base URL
const API_URL = "http://localhost:3000";

interface PaymentFlowProps {
  onApiResponse?: (response: unknown) => void;
}

export function PaymentFlow({ onApiResponse }: PaymentFlowProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Step 1: Create PaymentIntent and get clientSecret
  const startPayment = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/stripe/create-payment-intent`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to create payment intent");
      const data = await res.json();
      setClientSecret(data.clientSecret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment setup failed");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Handle successful payment
  const onPaymentSuccess = (id: string) => {
    setPaymentIntentId(id);
    setClientSecret(null);
  };

  // Step 3: Use PaymentIntent ID for API call
  const callApi = async (prompt: string) => {
    if (!paymentIntentId) return;

    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Stripe-Payment-Intent-Id": paymentIntentId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "message/send",
          params: {
            message: {
              role: "user",
              parts: [{ kind: "text", text: prompt }],
            },
          },
          id: 1,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Payment was rejected (already used, invalid, etc.)
        setError(data.message || "API request failed");
        return;
      }

      setPaymentIntentId(null); // Clear after successful use (single-use)
      onApiResponse?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "API request failed");
    } finally {
      setLoading(false);
    }
  };

  // Show payment form
  if (clientSecret) {
    return (
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <CheckoutForm
          onSuccess={onPaymentSuccess}
          onError={(msg) => {
            setError(msg);
            setClientSecret(null);
          }}
        />
      </Elements>
    );
  }

  // Show main UI
  return (
    <div>
      {error && <div style={{ color: "red", marginBottom: 16 }}>{error}</div>}

      {!paymentIntentId ? (
        <button onClick={startPayment} disabled={loading}>
          {loading ? "Loading..." : "Pay $1.00 to Search Flights"}
        </button>
      ) : (
        <div>
          <p>Payment successful! You can now search for flights.</p>
          <button onClick={() => callApi("Find cheap flights from NYC to London")} disabled={loading}>
            {loading ? "Searching..." : "Search Flights"}
          </button>
        </div>
      )}
    </div>
  );
}

interface CheckoutFormProps {
  onSuccess: (paymentIntentId: string) => void;
  onError: (message: string) => void;
}

function CheckoutForm({ onSuccess, onError }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    setLoading(false);

    if (error) {
      onError(error.message || "Payment failed");
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      onSuccess(paymentIntent.id);
    } else {
      onError("Payment was not completed");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button type="submit" disabled={!stripe || loading} style={{ marginTop: 16 }}>
        {loading ? "Processing..." : "Pay"}
      </button>
    </form>
  );
}
```

#### Usage in Your App

```tsx
import { PaymentFlow } from "./PaymentFlow";

function App() {
  return (
    <PaymentFlow
      onApiResponse={(response) => {
        console.log("Flight search results:", response);
      }}
    />
  );
}
```

### Testing

#### Test Cards

Use these [Stripe test cards](https://docs.stripe.com/testing#cards):

| Card Number      | Description        |
| ---------------- | ------------------ |
| 4242424242424242 | Succeeds           |
| 4000000000000002 | Card declined      |
| 4000002500003155 | Requires 3D Secure |

#### Manual Testing with cURL

```bash
# 1. Create a PaymentIntent via the backend
curl -X POST http://localhost:3000/stripe/create-payment-intent

# 2. Note the paymentIntentId from the response
# 3. Complete payment in your frontend with Stripe.js
# 4. Use the PaymentIntent ID:

curl -X POST http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -H "X-Stripe-Payment-Intent-Id: pi_xxx" \
  -d '{"jsonrpc":"2.0","method":"message/send","params":{"message":{"role":"user","parts":[{"kind":"text","text":"Find flights from NYC to London"}]}},"id":1}'

# First request: succeeds
# Second request with same ID: "Payment already used"
```

> **Note:** PaymentIntents created directly via Stripe CLI or Dashboard won't work because they lack the required `expected_amount` metadata that our backend uses to verify the payment was created through our system.

## Usage Examples

### Using the Agent (A2A Protocol)

```bash
curl -X POST http://localhost:3000/agent \
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
