# SKILL.md — AI Agent CLI Reference

This file is optimized for AI agents working with the aixyz CLI tools.
All commands support `--help` for full usage details.

## Quick Reference

### Scaffold a new agent project

```bash
# See all options
bunx create-aixyz-app --help

# Non-interactive (recommended for AI)
bunx create-aixyz-app my-agent --yes
bunx create-aixyz-app my-agent --erc-8004 --openai-api-key sk-... --pay-to 0x...
bunx create-aixyz-app my-agent --yes --no-install
```

### Develop and build

```bash
# See all options
aixyz --help
aixyz dev --help
aixyz build --help

# Start dev server
aixyz dev --port 3000

# Build for deployment
aixyz build                        # Standalone (default)
aixyz build --output vercel        # Vercel
VERCEL=1 aixyz build               # Auto-detect Vercel
```

### ERC-8004 Agent Identity

```bash
# See all options
aixyz erc-8004 register --help
aixyz erc-8004 update --help

# Register (non-interactive, CI-friendly)
aixyz erc-8004 register \
  --url "https://my-agent.example.com" \
  --chain-id 84532 \
  --supported-trust "reputation,tee-attestation" \
  --keystore ~/.foundry/keystores/default \
  --broadcast

# Register with PRIVATE_KEY env
PRIVATE_KEY=0x... aixyz erc-8004 register \
  --url "https://my-agent.example.com" \
  --chain-id 84532 \
  --broadcast

# Update agent URI (non-interactive)
aixyz erc-8004 update \
  --url "https://new-domain.example.com" \
  --agent-id 42 \
  --keystore ~/.foundry/keystores/default \
  --broadcast
```

## Non-TTY Behavior

All CLI commands are designed for non-interactive use. When `stdin` is not a TTY:

- Interactive prompts are skipped entirely.
- Values come from CLI flags, environment variables, or sensible defaults.
- Missing required values produce a clear error message indicating which flag to provide.

### `create-aixyz-app` flags

| Flag                     | Description                             | Default                                      |
| ------------------------ | --------------------------------------- | -------------------------------------------- |
| `[name]`                 | Agent name (positional argument)        | `my-agent`                                   |
| `-y, --yes`              | Use all defaults, skip prompts          |                                              |
| `--erc-8004`             | Include ERC-8004 Agent Identity support | `false`                                      |
| `--openai-api-key <key>` | OpenAI API key for `.env.local`         | empty                                        |
| `--pay-to <address>`     | x402 payTo Ethereum address             | `0x0799872E07EA7a63c79357694504FE66EDfE4a0A` |
| `--no-install`           | Skip `bun install`                      |                                              |

### `aixyz erc-8004 register` flags

| Flag                       | Description                           | Required in non-TTY |
| -------------------------- | ------------------------------------- | ------------------- |
| `--url <url>`              | Agent deployment URL                  | Yes                 |
| `--chain-id <id>`          | Target chain numeric ID               | Yes                 |
| `--supported-trust <list>` | Comma-separated trust mechanisms      | If no erc-8004.ts   |
| `--keystore <path>`        | Keystore file path                    | One of keystore,    |
| `--browser`                | Use browser wallet                    | browser, or         |
| `PRIVATE_KEY` env          | Private key for signing               | PRIVATE_KEY         |
| `--broadcast`              | Execute on-chain (default is dry-run) | No                  |
| `--rpc-url <url>`          | Custom RPC endpoint                   | For custom chains   |
| `--registry <address>`     | Registry contract address             | For custom chains   |
| `--out-dir <path>`         | Write result JSON to directory        | No                  |

### `aixyz erc-8004 update` flags

| Flag                   | Description                           | Required in non-TTY       |
| ---------------------- | ------------------------------------- | ------------------------- |
| `--url <url>`          | New agent deployment URL              | Yes                       |
| `--agent-id <id>`      | Agent ID to update                    | If multiple registrations |
| `--keystore <path>`    | Keystore file path                    | One of keystore,          |
| `--browser`            | Use browser wallet                    | browser, or               |
| `PRIVATE_KEY` env      | Private key for signing               | PRIVATE_KEY               |
| `--broadcast`          | Execute on-chain (default is dry-run) | No                        |
| `--rpc-url <url>`      | Custom RPC endpoint                   | For custom chains         |
| `--registry <address>` | Registry contract address             | For localhost only        |
| `--out-dir <path>`     | Write result JSON to directory        | No                        |
