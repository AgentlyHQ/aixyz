# Vercel Blob Agent

An AI agent that stores, retrieves, and manages files using [Vercel Blob](https://vercel.com/docs/vercel-blob) storage. Demonstrates integrating cloud blob storage with an aixyz agent gated behind x402 micropayments.

## Quick Start

```bash
bun install

# Create .env.local with your keys
cat > .env.local <<EOF
OPENAI_API_KEY=sk-...
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
EOF

bun run dev
```

## Project Structure

```
app/
├── agent.ts              # Agent with blob storage tools
├── tools/
│   ├── uploadBlob.ts     # Upload text content to Vercel Blob
│   ├── listBlobs.ts      # List stored blobs
│   └── deleteBlob.ts     # Delete a blob by URL
└── icon.png
```

## Skills

| Skill       | Example                                     |
| ----------- | ------------------------------------------- |
| Upload File | "Store this text: Hello World"              |
| List Files  | "Show me all stored files"                  |
| Delete File | "Delete the file at https://blob.vercel..." |

## Environment Variables

| Variable                | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `OPENAI_API_KEY`        | OpenAI API key                                       |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token (from Vercel dashboard) |

## Setting Up Vercel Blob

1. Go to your [Vercel dashboard](https://vercel.com/dashboard)
2. Navigate to **Storage** → **Create** → **Blob**
3. Copy the `BLOB_READ_WRITE_TOKEN` from the `.env.local` tab into your local `.env.local`

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
bun run build
vercel
```

When deploying to Vercel, link the Blob store to your project in the Vercel dashboard so that `BLOB_READ_WRITE_TOKEN` is automatically injected into the deployment environment.
