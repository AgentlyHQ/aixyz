# Vercel Blob txt (MCP-only)

This template exposes two MCP tools that work with private `.txt` files on [Vercel Blob](https://vercel.com/docs/storage/vercel-blob):

- `put-text` — store text in a private blob with a UUID hex ID
- `get-text` — read a private blob back as text

Each call is priced at `$0.001` via x402.

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

## Tools

- `put-text`
  - Input: `text` (required), `folder` (optional, default `txt/`)
  - Behavior: Generates a UUID hex ID and writes the text to `folder/{id}.txt` as **private** with `allowOverwrite: false`
  - Returns: `id`, `path`, `url`, `downloadUrl`
- `get-text`
  - Input: `path` (required) — blob pathname like `txt/<uuid>.txt` or full blob URL
  - Behavior: Fetches the private blob and returns its text content
  - Returns: `path`, `text`, `contentType`, `size`

## Connecting via MCP

Point your MCP client (Claude Desktop, VS Code MCP extension, etc.) at `http://localhost:3000/mcp`. The tool will appear as `putTxt` with the schema above. No A2A agent is present in this template.

## Payment

Both tools cost `$0.001` per call. Payments use the x402 config in `aixyz.config.ts` (Base mainnet in production, Base Sepolia in development).

## Deploy

```bash
bun run build
vercel
```
