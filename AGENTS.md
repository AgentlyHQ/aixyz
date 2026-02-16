# AGENTS

## Project overview

- Monorepo for aixyz - a framework for bundling AI agents from any framework into deployable services
- Managed with Bun workspaces and Turbo
- Runtime: Bun 1.3.9+
- Supports A2A, MCP, x402 payments, and ERC-8004 identity protocols
- TypeScript-based with strict type safety

## Repo layout

### Packages (`packages/*`)

Core packages:

- **`aixyz`** - Main framework package with server adapters, request handlers, and protocol implementations
- **`aixyz-cli`** - CLI for building and deploying agents (`dev`, `build` commands)
- **`aixyz-config`** - Configuration management using Zod schemas
- **`aixyz-stripe`** - Stripe payment adapter for aixyz agents
- **`create-aixyz-app`** - Project scaffolding tool (used via `pnpm create aixyz-app`)
- **`erc-8004`** - ERC-8004 contract ABIs, addresses, and Solidity sources
- **`agently-cli`** - CLI for ERC-8004 registry operations (`register`, `set-agent-uri`)

### Examples (`examples/*`)

Working example agents demonstrating different use cases:

- **`agent-boilerplate`** - Minimal starter template
- **`agent-chainlink`** - Chainlink data feeds integration
- **`agent-job-hunter`** - Job search agent
- **`agent-price-oracle`** - Cryptocurrency price oracle using CoinGecko
- **`agent-travel`** - Flight search with Stripe payment integration
- **`agent-with-custom-server`** - Custom server setup example

### Root config

- `package.json` - Workspace configuration and scripts
- `turbo.json` - Turborepo build pipeline configuration
- `.devcontainer/` - GitHub Codespaces configuration with Bun 1.3.9

## Setup

```bash
bun install
```

## Common commands (root)

- **Dev**: `bun run dev` - Start all packages in dev mode (Turbo: `turbo run dev`)
- **Build**: `bun run build` - Build all packages
- **Test**: `bun run test` - Run tests across all packages
- **Lint**: `bun run lint` - Auto-fix linting issues
- **Format**: `bun run format` - Format code with Prettier (printWidth: 120)
- **Clean**: `bun run clean` - Clean build artifacts

## Working with packages

### For specific packages

Use Turbo or Bun filters for package-specific tasks:

```bash
# Using turbo
turbo run dev --filter=aixyz
turbo run build --filter=@examples/agent-travel

# Using bun
bun --filter aixyz run build
bun --filter @examples/agent-travel run dev
```

### Building example agents

Example agents use `aixyz` CLI commands:

```bash
cd examples/agent-travel
bun run dev    # Run: aixyz dev
bun run build  # Run: aixyz build
```

The `aixyz build` command:

- Loads `aixyz.config.ts`
- Detects entrypoint (`app/agent.ts` or `app/server.ts`)
- Bundles with `Bun.build()` targeting Node.js
- Outputs Vercel Build Output API v3 structure

## Agent structure

Example agents follow this structure:

```
examples/agent-*/
  aixyz.config.ts     # Agent metadata and configuration
  app/
    agent.ts          # Agent definition (framework-specific)
    server.ts         # Optional: custom server setup
    tools/            # Tool implementations
    icon.png          # Agent icon
  package.json
  tsconfig.json
  vercel.json         # Vercel deployment config
```

## CLI tools

### aixyz-cli

Development and deployment CLI:

```bash
aixyz dev           # Start local dev server with hot reload
aixyz build         # Bundle for Vercel deployment
```

### agently-cli

ERC-8004 registry operations:

```bash
agently-cli register        # Register new agent on-chain
agently-cli set-agent-uri   # Update agent metadata URI
```

## Adapters

Framework adapters wrap agents into the `AgentExecutor` interface:

- **Vercel AI SDK**: `aixyz/server/adapters/ai` (ToolLoopAgentExecutor)
- **LangChain**: `aixyz/server/adapters/langchain` (LangChainAgentExecutor)
- **Mastra**: `aixyz/server/adapters/mastra` (MastraAgentExecutor)

Note: Only A2A and MCP adapters are currently in the codebase (`server/adapters/a2a.ts`, `server/adapters/mcp.ts`). Other framework adapters are referenced in documentation but may be in development.

## Protocols

- **A2A**: Agent card generation and JSON-RPC endpoint
- **MCP**: Tool sharing with MCP-compatible clients
- **x402**: HTTP 402 micropayments for API access
- **ERC-8004**: On-chain agent identity verification

## Working conventions

- Use Turbo or `bun --filter <package>` for package-specific tasks
- Keep edits consistent with Prettier formatting (printWidth: 120)
- Examples use `app/` directory structure (not `src/`)
- All packages use TypeScript with strict type checking
- Follow existing patterns for new examples or packages
- Test changes in example agents to verify framework functionality
