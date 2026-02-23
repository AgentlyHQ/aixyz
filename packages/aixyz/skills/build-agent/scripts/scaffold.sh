#!/usr/bin/env bash
# scaffold.sh — Scaffold a new aixyz agent project
#
# Usage:
#   ./scaffold.sh <project-name>
#
# Creates a new directory <project-name>/ with the minimal file structure
# required to run an aixyz agent locally and deploy it to Vercel.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <project-name>" >&2
  exit 1
fi

PROJECT_NAME="$1"
PKG_NAME="$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//; s/-$//')"

if [[ -d "$PROJECT_NAME" ]]; then
  echo "Error: directory '$PROJECT_NAME' already exists." >&2
  exit 1
fi

echo "Scaffolding agent: $PROJECT_NAME"

mkdir -p "$PROJECT_NAME/app/tools"

# ── aixyz.config.ts ──────────────────────────────────────────────────────────
cat > "$PROJECT_NAME/aixyz.config.ts" << CONFIGEOF
import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "$PROJECT_NAME",
  description: "A short description of what this agent does.",
  version: "0.1.0",
  x402: {
    payTo: process.env.X402_PAY_TO!,
    network: process.env.NODE_ENV === "production" ? "eip155:8453" : "eip155:84532",
  },
  skills: [
    {
      id: "my-skill",
      name: "My Skill",
      description: "Describe what this skill does.",
      tags: ["example"],
      examples: ["Ask me something"],
    },
  ],
};

export default config;
CONFIGEOF

# ── app/agent.ts ─────────────────────────────────────────────────────────────
cat > "$PROJECT_NAME/app/agent.ts" << 'AGENTEOF'
import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: "You are a helpful assistant.",
  tools: {},
  stopWhen: stepCountIs(10),
});
AGENTEOF

# ── app/tools/example.ts ──────────────────────────────────────────────────────
cat > "$PROJECT_NAME/app/tools/example.ts" << 'TOOLEOF'
import { tool } from "ai";
import { z } from "zod";
import type { Accepts } from "aixyz/accepts";

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default tool({
  description: "An example tool — replace this with your own logic.",
  inputSchema: z.object({
    input: z.string().describe("Input to the tool"),
  }),
  execute: async ({ input }) => {
    return { result: input };
  },
});
TOOLEOF

# ── package.json ──────────────────────────────────────────────────────────────
cat > "$PROJECT_NAME/package.json" << PKGJSONEOF
{
  "name": "$PKG_NAME",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "aixyz dev",
    "build": "aixyz build"
  },
  "dependencies": {
    "@ai-sdk/openai": "^3",
    "ai": "^6",
    "aixyz": "^0"
  }
}
PKGJSONEOF

# ── tsconfig.json ─────────────────────────────────────────────────────────────
cat > "$PROJECT_NAME/tsconfig.json" << 'TSCONFIGEOF'
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true
  }
}
TSCONFIGEOF

# ── vercel.json ───────────────────────────────────────────────────────────────
cat > "$PROJECT_NAME/vercel.json" << 'VERCELJSONEOF'
{
  "buildCommand": "bun run build",
  "framework": null
}
VERCELJSONEOF

# ── .env.local ────────────────────────────────────────────────────────────────
cat > "$PROJECT_NAME/.env.local" << 'ENVEOF'
# Your EVM wallet address that receives x402 payments
X402_PAY_TO=0x0000000000000000000000000000000000000000
# OpenAI API key
OPENAI_API_KEY=sk-...
ENVEOF

# ── .gitignore ────────────────────────────────────────────────────────────────
cat > "$PROJECT_NAME/.gitignore" << 'GITIGNOREEOF'
node_modules/
.env.local
.env.*.local
.aixyz/
.vercel/
dist/
GITIGNOREEOF

echo ""
echo "✓ Created $PROJECT_NAME/"
echo ""
echo "Next steps:"
echo "  cd $PROJECT_NAME"
echo "  bun install"
echo "  bun run dev"
