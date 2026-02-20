# aixyz-cli

[![npm](https://img.shields.io/npm/v/aixyz-cli)](https://www.npmjs.com/package/aixyz-cli)

CLI for building and deploying [aixyz](https://ai-xyz.dev) agents.

## Quick Start

Run without installing:

```bash
bunx aixyz-cli dev
npx aixyz-cli dev
```

> Note: Requires [Bun](https://bun.sh) to be installed on your system.

## Installation

```bash
bun add aixyz-cli
```

## Commands

### `aixyz-cli dev`

Start a local development server with file watching and auto-restart.

```bash
aixyz-cli dev
aixyz-cli dev --port 8080
```

### `aixyz-cli build`

Build the agent for deployment.

**Default behavior:** Bundles into a single file for Bun Runtime at `./.aixyz/output/server.js`

```bash
aixyz-cli build
```

**With --vercel flag or VERCEL=1:** Build for Vercel deployment using the [Build Output API v3](https://vercel.com/docs/build-output-api/v3) at `.vercel/output/`

```bash
aixyz-cli build --vercel
# or automatically detected on Vercel
VERCEL=1 aixyz-cli build
```

## License

MIT
