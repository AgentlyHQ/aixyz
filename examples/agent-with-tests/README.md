# Agent with Tests

Demonstrates testing patterns for aixyz agents using `bun:test`. Covers both deterministic unit tests (no API key needed) and non-deterministic integration tests (require `OPENAI_API_KEY`), plus an end-to-end test that builds the standalone output and starts the server.

## Quick Start

```bash
bun install

# Run unit tests (no API key required)
bun test app/agent.test.ts

# Run end-to-end test (builds the agent first)
bun test server.e2e.test.ts
```

## Project Structure

```
app/
├── agent.ts        # Temperature conversion agent
├── agent.test.ts   # Unit and integration tests
└── tools/
    └── temperature.ts
server.e2e.test.ts  # End-to-end test (builds + starts server)
```

## Test Patterns

### Deterministic tests — no API calls

```typescript
test("default export is a ToolLoopAgent", () => {
  expect(agent).toBeInstanceOf(ToolLoopAgent);
});

test("has convertTemperature tool registered", () => {
  expect(agent.tools).toHaveProperty("convertTemperature");
});
```

### Non-deterministic tests — require `OPENAI_API_KEY`

```typescript
describe("non deterministic agent test", () => {
  loadEnv(); // loads .env.test.local

  test.skipIf(!process.env.OPENAI_API_KEY)("agent can convert temperature", async () => {
    const result = await agent.generate({ prompt: "convert 100°C to fahrenheit" });
    expect(result.text).toContain("212");
  });
});
```

### End-to-end test

`server.e2e.test.ts` builds the standalone output, starts the server, and tests the A2A and MCP endpoints via HTTP. It runs automatically with `bun test`.

## Environment Variables

| Variable         | Description                               |
| ---------------- | ----------------------------------------- |
| `OPENAI_API_KEY` | Required for non-deterministic tests only |

## Running the Agent

```bash
bun run dev
```

| Endpoint                       | Description           |
| ------------------------------ | --------------------- |
| `/.well-known/agent-card.json` | A2A agent card        |
| `POST /agent`                  | A2A JSON-RPC endpoint |
| `POST /mcp`                    | MCP tool endpoint     |

## Payment

Charges `$0.001` per request via x402 on Base (mainnet in production, Base Sepolia in development).

## Build & Deploy

```bash
bun run build
vercel
```
