# Vercel Blob txt (MCP-only)

This template exposes a single MCP tool, `putTxt`, that writes private `.txt` files to [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) using `@vercel/blob`. IDs are UUID hex strings (no base58), and each write is priced at `$0.001` via x402.

## Prerequisites

Set a Vercel Blob read/write token:

```bash
echo 'BLOB_READ_WRITE_TOKEN=...' >> .env.local
```

## Run locally

```bash
bun install
bun run dev
```

The server exposes only the MCP endpoint at `http://localhost:3000/mcp` (no `app/agent.ts`).

## Tool: `putTxt`

Input:

- `text` (required) — UTF-8 text content written to the blob
- `folder` (optional) — folder prefix (default `txt/`)
- `expiresInDays` (optional) — TTL in days, clamped to 1-365 (default 365)

Behavior:

- Generates a UUID hex ID (`32` lowercase hex chars) and writes to `folder/{id}.txt`
- Prepends metadata (`createdAt`, `expiresAt`) to the text body
- Stores the blob as **private** with `allowOverwrite: false`
- Returns blob URLs plus timestamps and path

## Connecting via MCP

Point your MCP client (Claude Desktop, VS Code MCP extension, etc.) at `http://localhost:3000/mcp`. The tool will appear as `putTxt` with the schema above. No A2A agent is present in this template.

## Payment

`putTxt` costs `$0.001` per call. Payments use the x402 config in `aixyz.config.ts` (Base mainnet in production, Base Sepolia in development).

## Deploy

```bash
bun run build
vercel
```
