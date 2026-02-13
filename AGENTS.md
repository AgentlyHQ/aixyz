# AGENTS

## Project overview

- Monorepo for aixyz, managed with Bun workspaces and Turbo.
- Runtime: Bun (latest).
- TypeScript tooling is present at the root; package contents are minimal so far.

## Repo layout

- `packages/*`: workspace packages (`packages/erc-8004`, `packages/create-8004`).
- `examples/*`: example apps (`examples/agent-chainlink`).
- Root config: `package.json`, `turbo.json`.

## Setup

- Install dependencies: `bun install`

## Common commands (root)

- Dev: `bun run dev` (Turbo: `turbo run dev`)
- Build: `bun run build`
- Test: `bun run test`
- Lint (auto-fix): `bun run lint`
- Format: `bun run format` (Prettier, `printWidth: 120`)
- Clean: `bun run clean`

## Working conventions

- Prefer Turbo or `bun --filter <package>` for package-specific tasks.
- Keep edits consistent with Prettier formatting and the existing minimal structure.
