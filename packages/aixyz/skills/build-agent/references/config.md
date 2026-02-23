# aixyz.config.ts Reference

## All Fields

| Field          | Type                       | Required | Description                                                                 |
| -------------- | -------------------------- | -------- | --------------------------------------------------------------------------- |
| `name`         | `string`                   | Yes      | Agent display name (used in A2A agent card)                                 |
| `description`  | `string`                   | Yes      | What the agent does                                                         |
| `version`      | `string`                   | Yes      | Semver version (e.g. `"0.1.0"`)                                             |
| `url`          | `string`                   | No       | Agent base URL. Auto-detected from `VERCEL_URL`                             |
| `x402.payTo`   | `string`                   | Yes      | EVM wallet address to receive payments. Falls back to `X402_PAY_TO` env var |
| `x402.network` | `string`                   | Yes      | x402 payment network in `eip155:<chainId>` format. No fallback              |
| `build.output` | `"standalone" \| "vercel"` | No       | Override build output format                                                |
| `skills`       | `AgentSkill[]`             | No       | Skills list (defaults to `[]`)                                              |

## Skill Object

| Field         | Type                         | Required | Description                                      |
| ------------- | ---------------------------- | -------- | ------------------------------------------------ |
| `id`          | `string`                     | Yes      | Unique skill identifier (kebab-case recommended) |
| `name`        | `string`                     | Yes      | Human-readable skill name                        |
| `description` | `string`                     | Yes      | What the skill does                              |
| `tags`        | `string[]`                   | Yes      | Searchable tags                                  |
| `examples`    | `string[]`                   | No       | Example prompts that exercise the skill          |
| `inputModes`  | `string[]`                   | No       | Supported input MIME types                       |
| `outputModes` | `string[]`                   | No       | Supported output MIME types                      |
| `security`    | `Record<string, string[]>[]` | No       | Security scheme requirements                     |

## Network Values

| Network                | Chain ID | `x402.network` value |
| ---------------------- | -------- | -------------------- |
| Base mainnet           | 8453     | `"eip155:8453"`      |
| Base Sepolia (testnet) | 84532    | `"eip155:84532"`     |
| Ethereum mainnet       | 1        | `"eip155:1"`         |
| Polygon                | 137      | `"eip155:137"`       |

## Environment Variables

Environment variables are loaded in the same priority order as Next.js:

1. `process.env` (already set)
2. `.env.<NODE_ENV>.local`
3. `.env.local` (skipped when `NODE_ENV=test`)
4. `.env.<NODE_ENV>`
5. `.env`

Relevant variables:

| Variable               | Description                                                             |
| ---------------------- | ----------------------------------------------------------------------- |
| `X402_PAY_TO`          | Default payment recipient address                                       |
| `X402_NETWORK`         | Default payment network                                                 |
| `X402_FACILITATOR_URL` | Custom facilitator URL (default: `https://x402.agently.to/facilitator`) |
| `VERCEL_URL`           | Auto-set by Vercel; used to build the canonical `url`                   |
| `OPENAI_API_KEY`       | OpenAI API key                                                          |

## Example

```ts
import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Weather Agent",
  description: "Get current weather for any location worldwide.",
  version: "0.1.0",
  x402: {
    payTo: process.env.X402_PAY_TO!,
    network: process.env.NODE_ENV === "production" ? "eip155:8453" : "eip155:84532",
  },
  skills: [
    {
      id: "get-weather",
      name: "Get Weather",
      description: "Get current weather conditions for any city or location",
      tags: ["weather"],
      examples: ["What's the weather in Tokyo?"],
    },
  ],
};

export default config;
```
