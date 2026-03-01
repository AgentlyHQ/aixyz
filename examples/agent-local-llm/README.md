# Local LLM Agent

Runs a quantized language model entirely in-process using [Transformers.js](https://huggingface.co/docs/transformers.js) (ONNX/WebAssembly). No external API server and no API key are required. The model (`onnx-community/Qwen2.5-1.5B-Instruct`, q4) is downloaded from HuggingFace Hub on first run and cached locally.

## Quick Start

```bash
bun install

# First run downloads the model (~1 GB) — subsequent runs use the cache
bun run dev
```

## Project Structure

```
app/
├── agent.ts            # Agent with local LLM model
├── agent.test.ts       # Integration test
└── tools/
    └── temperature.ts  # Temperature conversion tool
prewarm.ts              # Model prewarming script (used by Docker)
Dockerfile              # Multi-stage image with prewarmed model
```

## Skills

| Skill               | Example                       |
| ------------------- | ----------------------------- |
| Convert Temperature | "Convert 100°C to Fahrenheit" |
|                     | "What is 72°F in Celsius?"    |

## Environment Variables

No API keys required. Optional variables:

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `PORT`   | Server port | 3000    |

## API Endpoints

| Endpoint                       | Description           |
| ------------------------------ | --------------------- |
| `/.well-known/agent-card.json` | A2A agent card        |
| `POST /agent`                  | A2A JSON-RPC endpoint |
| `POST /mcp`                    | MCP tool endpoint     |

## Payment

This agent is free (`scheme: "free"`) — no x402 payment is required.

## Docker Deployment

The Docker image preloads the model at build time so the container starts serving requests immediately with no cold-start delay.

```bash
# Build and run
docker build -t agent-local-llm .
docker run -p 3000:3000 agent-local-llm

# Or via npm scripts
bun run docker:build
bun run docker:run
```

## Build (Standalone)

This example uses standalone output (not Vercel) since it runs a local model:

```bash
bun run build   # outputs to .aixyz/output/server.js
```
