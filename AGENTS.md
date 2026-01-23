# AGENTS

## Project overview

- Monorepo for Agently, managed with pnpm workspaces and Turbo.
- Node.js requirement: `^24`.
- TypeScript tooling is present at the root; package contents are minimal so far.

## Repo layout

- `packages/*`: workspace packages (`packages/8004`, `packages/create-8004`).
- `examples/*`: example apps (`examples/agent-chainlink`).
- Root config: `package.json`, `pnpm-workspace.yaml`, `turbo.json`.

## Setup

- Install dependencies: `pnpm install`

## Common commands (root)

- Dev: `pnpm run dev` (Turbo: `turbo run dev`)
- Build: `pnpm run build`
- Test: `pnpm run test`
- Lint (auto-fix): `pnpm run lint`
- Format: `pnpm run format` (Prettier, `printWidth: 120`)
- Clean: `pnpm run clean`

## Working conventions

- Prefer Turbo or `pnpm --filter <package>` for package-specific tasks.
- Keep edits consistent with Prettier formatting and the existing minimal structure.
