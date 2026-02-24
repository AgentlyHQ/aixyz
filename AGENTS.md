# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Monorepo for aixyz — a framework for bundling AI agents from any framework into deployable services with A2A, MCP, x402 payments, and ERC-8004 identity protocols. Managed with Bun workspaces and Turbo. Runtime: Bun 1.3.9+.

## Commands

```bash
bun install                          # Setup
bun run build                        # Build all packages (turbo run build)
bun run test                         # Test all packages (turbo run test)
bun run lint                         # Lint all packages with --fix
bun run format                       # Format with Prettier (printWidth: 120)
bun run clean                        # Clean build artifacts
```

### Package-specific commands

```bash
bun run build --filter=aixyz         # Build a specific package
bun run test --filter=@aixyz/erc-8004  # Test a specific package
```

Or navigate directly:

```bash
cd packages/aixyz && bun run build
cd examples/agent-travel && bun run dev
```

### Running a single test

Tests use Bun's built-in test runner (`.test.ts` files):

```bash
bun test packages/aixyz-erc-8004/src/schemas/registration.test.ts
```

### Example agent dev/build

```bash
cd examples/agent-travel
bun run dev    # → aixyz dev (hot reload, watches app/ and aixyz.config.ts)
bun run build  # → aixyz build (bundles for deployment)
```

## Repo layout

### Packages (`packages/*`)

| Package            | npm name           | Description                                                                     |
| ------------------ | ------------------ | ------------------------------------------------------------------------------- |
| `aixyz`            | `aixyz`            | Main framework: server, adapters (A2A, MCP), x402 integration, Express-based    |
| `aixyz-cli`        | `@aixyz/cli`       | CLI commands: `dev` (hot reload server), `build` (bundle for Vercel/standalone) |
| `aixyz-config`     | `@aixyz/config`    | Zod-validated config loading from `aixyz.config.ts` + .env files                |
| `aixyz-stripe`     | `@aixyz/stripe`    | Experimental Stripe payment adapter                                             |
| `create-aixyz-app` | `create-aixyz-app` | Project scaffolding (`bunx create-aixyz-app`)                                   |
| `aixyz-erc-8004`   | `@aixyz/erc-8004`  | ERC-8004 contract ABIs, addresses, Zod schemas                                  |
| `aixyz-cli-erc`    | `@aixyz/cli-erc`   | CLI for ERC-8004 registry ops (`register`, `set-agent-uri`)                     |

### Examples (`examples/*`)

Working agents demonstrating patterns. All share the same structure:

```
examples/agent-*/
  aixyz.config.ts     # Agent metadata and config (required)
  app/
    agent.ts          # Agent definition (required if no server.ts)
    server.ts         # Custom server (optional, overrides auto-generation)
    accepts.ts        # Custom x402 facilitator (optional)
    tools/*.ts        # Tool implementations (files starting with _ ignored)
    icon.png          # Agent icon (served as static asset)
  vercel.json
```

### Documentation (`docs/`)

Mintlify documentation site (`mint dev` to preview locally). Structure:

- `docs/guides/` — Getting started, agent structure, custom server, configuration, CLI, deployment
- `docs/protocols/` — A2A, MCP, x402, ERC-8004 (collapsed under Documentation tab)
- `docs/packages/` — Package reference docs (collapsed under Documentation tab)
- `docs/templates/` — Individual pages for each example template (separate Templates tab)
- `docs/docs.json` — Mintlify navigation configuration

Protocols and Packages are groups within the Documentation tab (not separate tabs).
Templates have their own tab with one page per example.

Each `examples/agent-*/TEMPLATE.mdx` is a symlink to `docs/templates/<name>.mdx` for discoverability.

### Other

- `CLAUDE.md` symlinks to `AGENTS.md`

## Architecture

### How the build pipeline works (`@aixyz/cli`)

The `aixyz build` command in `packages/aixyz-cli/build/index.ts`:

1. Loads config from `aixyz.config.ts` via `@aixyz/config`
2. Uses two Bun build plugins:
   - **`AixyzConfigPlugin`** — Materializes resolved config into the bundle (replaces `aixyz/config` imports)
   - **`AixyzServerPlugin`** — Auto-generates `server.ts` from `app/` structure if no `app/server.ts` exists. Scans
     `app/agent.ts` and `app/tools/*.ts`, wires up A2A + MCP + x402 middleware
3. Bundles with `Bun.build()` targeting Node.js
4. Output format:
   - **Vercel** (when `VERCEL=1` or `--output vercel`): `.vercel/output/` Build Output API v3
   - **Standalone** (default): `.aixyz/output/server.js`

The `aixyz dev` command spawns a Bun worker process with file watching on `app/` and `aixyz.config.ts` (100ms debounce).

### Server class hierarchy

`AixyzServer` extends `x402ResourceServer` (from `@x402/express`), which wraps Express 5. Key methods:

- `withX402Exact()` — Register payment-gated routes
- `unstable_withIndexPage()` — Human-readable agent info page

### Protocol adapters (`packages/aixyz/server/adapters/`)

- **`a2a.ts`** — `useA2A(server, agent)`: Generates agent card at `/.well-known/agent-card.json`, JSON-RPC endpoint at
  `/agent`
- **`mcp.ts`** — `AixyzMCP`: Exposes tools at `/mcp` via `StreamableHTTPServerTransport`

### Config loading (`@aixyz/config`)

- `getAixyzConfig()` — Full config for build-time use
- `getAixyzConfigRuntime()` — Subset safe for runtime bundles
- Environment files loaded in Next.js order: `.env`, `.env.local`, `.env.$(NODE_ENV)`, `.env.$(NODE_ENV).local`

### Agent executor pattern

Agents are wrapped into `AgentExecutor` interface. The primary adapter is
`ToolLoopAgentExecutor` for Vercel AI SDK agents (imported from `ai`). Agents export a default `ToolLoopAgent` + an
`accepts` object for payment config.

### Payment model

Each agent and tool declares an `accepts` export controlling x402 payment:

```ts
export const accepts: Accepts = { scheme: "exact", price: "$0.005" };
```

Agents/tools without `accepts` are not registered on payment-gated endpoints.

## Dependency graph

```
aixyz → @aixyz/cli → @aixyz/config
     → @a2a-js/sdk, @modelcontextprotocol/sdk, @x402/*, express, zod
     → ai (optional peer dep, Vercel AI SDK v6)
```

## Working conventions

- Packages ship raw `.ts` files (`"files": ["**/*.ts"]`), not compiled JS (except `erc-8004` which compiles to CJS)
- Prettier: printWidth 120, plugin `prettier-plugin-packagejson`
- Pre-commit hook via Husky runs `lint-staged` (Prettier on staged files)
- Examples use `app/` directory structure (not `src/`)
- CI runs: build, lint, test, format check (`.github/workflows/ci.yml`)
- Publishing: triggered by GitHub releases, uses npm OIDC provenance
