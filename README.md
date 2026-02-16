# 🐁 ai-xyz.dev

> **The deployment and monetization layer for autonomous AI agents**

[![npm](https://img.shields.io/npm/v/aixyz)](https://www.npmjs.com/package/aixyz)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Build AI agents with any framework (Vercel AI SDK, LangChain, Mastra) and deploy them as production-ready services with built-in:

- 🤝 **A2A** - Agent-to-agent communication
- 🔧 **MCP** - Tool sharing with AI clients
- 💰 **x402** - Blockchain micropayments
- 🆔 **ERC-8004** - On-chain identity & reputation

**📚 [Full Documentation](https://ai-xyz.dev)** • [Quickstart](https://ai-xyz.dev/quickstart) • [Architecture](https://ai-xyz.dev/architecture) • [Examples](https://ai-xyz.dev/examples)

## Quick Start

```bash
pnpm create aixyz-app my-agent
cd my-agent
pnpm install
bun run dev
```

Your agent is now running with:

- A2A endpoint at `POST /agent`
- MCP endpoint at `/mcp`
- Agent card at `/.well-known/agent-card.json`

## Why ai-xyz.dev?

**Before ai-xyz.dev:**

```ts
// Manually integrate multiple protocols
// Set up payment infrastructure
// Configure agent discovery
// Handle identity and reputation
// Deploy and scale services
// 😓 Lots of boilerplate
```

**With ai-xyz.dev:**

```ts
// Write your agent logic
export const agent = new ToolLoopAgent({ ... });

// Done! Everything else is automatic ✨
```

## What You Get

| Feature                | Description                                                          |
| ---------------------- | -------------------------------------------------------------------- |
| **Framework Agnostic** | Works with Vercel AI SDK, LangChain, Mastra, or any custom framework |
| **Multi-Protocol**     | A2A, MCP, x402, and ERC-8004 automatically configured                |
| **Dual Payments**      | Accept crypto (x402) and traditional (Stripe) payments               |
| **Auto-Configuration** | CLI generates server code and metadata from your tools               |
| **Vercel-Optimized**   | Zero-config serverless deployment                                    |
| **Type-Safe**          | Full TypeScript with Zod validation                                  |

## Learn More

- **[Quickstart Guide](https://ai-xyz.dev/quickstart)** - Build your first agent in 5 minutes
- **[Architecture](https://ai-xyz.dev/architecture)** - Understand how it works
- **[Protocols](https://ai-xyz.dev/protocols)** - Deep dive into A2A, MCP, x402, and ERC-8004
- **[Examples](https://ai-xyz.dev/examples)** - Real-world agent implementations

## Community

- [GitHub](https://github.com/AgentlyHQ/aixyz)
- [npm](https://www.npmjs.com/package/aixyz)
- [Documentation](https://ai-xyz.dev)

## Contributing

```bash
bun install
bun run dev
bun run format  # before committing
```

See [CONTRIBUTING.md](https://ai-xyz.dev/contributing) for details.

## License

MIT
