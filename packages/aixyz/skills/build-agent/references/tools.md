# Tools Reference

## Tool File Convention

Each file in `app/tools/` is automatically discovered by the auto-generated server.

- Files must export a Vercel AI SDK `tool` as their **default export**.
- Files prefixed with `_` (e.g. `_helpers.ts`) are **ignored**.
- Files can optionally export `accepts` to gate the tool behind an x402 payment.

## Default Export — `tool()`

```ts
import { tool } from "ai";
import { z } from "zod";

export default tool({
  description: "...", // required: shown to the agent/MCP client
  inputSchema: z.object({
    // required: Zod schema for parameters
    param: z.string(),
  }),
  execute: async (input) => {
    // return any JSON-serializable value
    return { result: "..." };
  },
});
```

## Named Export — `accepts`

Controls payment for this tool when accessed via MCP:

```ts
import type { Accepts } from "aixyz/accepts";

// Require x402 payment
export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001", // USD-denominated string
  network: "eip155:8453", // optional, defaults to config.x402.network
  payTo: "0x...", // optional, defaults to config.x402.payTo
};

// Free access
export const accepts: Accepts = {
  scheme: "free",
};
```

Tools without an `accepts` export are **not registered** for MCP payment gating.

## Using Tools in the Agent

Import tools and pass them to the agent's `tools` object:

```ts
import myTool from "./tools/my-tool";
import anotherTool from "./tools/another-tool";

export default new ToolLoopAgent({
  // ...
  tools: { myTool, anotherTool },
});
```

## Manual MCP Registration (Custom Server)

When using `app/server.ts`, register tools manually with `AixyzMCP`:

```ts
import { AixyzMCP } from "aixyz/server/adapters/mcp";
import myTool from "./tools/my-tool";

const mcp = new AixyzMCP(server);
await mcp.register("myTool", {
  default: myTool,
  accepts: { scheme: "exact", price: "$0.001" },
});
await mcp.connect();
```
