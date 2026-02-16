# Example: Agent with Custom Server

This example demonstrates how to define a custom
`server.ts` to take full control over how your agent and tools are registered.

By default, `aixyz` auto-generates a server entrypoint that registers your `app/agent.ts` with A2A and all
`app/tools/*.ts` with MCP based on their `export const accepts` declarations.
When you provide your own `app/server.ts`, the auto-generation is skipped and you control everything.

## Why use a custom server?

- **Override pricing per-endpoint** — set different prices for A2A vs MCP, or per-tool.
- **Omit `accepts` from tools** — define pricing in `server.ts` instead of co-locating it with the tool.
- **Add custom routes** — mount health checks, webhooks, or other endpoints alongside A2A/MCP.
- **Conditional registration** — only expose certain tools or the agent based on environment variables.

## Project Structure

```
app/
├── agent.ts       # ToolLoopAgent definition with accepts for A2A
├── server.ts      # Custom server — manually registers A2A + MCP
└── tools/
    └── lookup.ts  # Tool without accepts (pricing defined in server.ts)
```

## Key Differences from Default

In a standard `aixyz` project, each tool exports its own `accepts`:

```ts
// app/tools/lookup.ts (standard)
export const accepts: Accepts = { scheme: "exact", price: "$0.01" };
export default tool({ ... });
```

With a custom server, you can omit `accepts` from the tool and define it in `server.ts`:

```ts
// app/tools/lookup.ts (custom server)
// No accepts export — pricing is handled in server.ts
export default tool({ ... });
```

```ts
// app/server.ts
import lookup from "./tools/lookup";

const mcp = new AixyzMCP(server);
await mcp.register("latestData", {
  default: lookup,
  accepts: { scheme: "exact", price: "$0.001" },
});
```

## Setup

```bash
bun install
```

Create a `.env.local` with your keys:

```env
OPENAI_API_KEY=sk-...
X402_PAY_TO=0xYourAddress
X402_NETWORK=eip155:8453
```

## Development

```bash
bun run dev
```

## Build

```bash
bun run build
```
