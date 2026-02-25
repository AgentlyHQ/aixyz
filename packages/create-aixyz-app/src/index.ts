#!/usr/bin/env node

import * as p from "@clack/prompts";
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("-")));
const positional = args.filter((a) => !a.startsWith("-"));

const useDefaults = flags.has("--yes") || flags.has("-y");

// Check if Bun is installed
function checkBunInstalled(): boolean {
  try {
    execSync("bun --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Detect which package manager is being used
function detectPackageManager(): string {
  const userAgent = process.env.npm_config_user_agent || "";
  if (userAgent.includes("bun")) return "bun";
  if (userAgent.includes("npm")) return "npm";
  if (userAgent.includes("yarn")) return "yarn";
  if (userAgent.includes("pnpm")) return "pnpm";
  return "unknown";
}

// Sanitize agent name to kebab-case for package name
function sanitizePkgName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, "") // Remove invalid characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

p.intro("Create aixyz app");

// Check if Bun is installed
const hasBun = checkBunInstalled();
const packageManager = detectPackageManager();

if (!hasBun) {
  p.log.error("Bun is not installed on your system.");
  p.log.info("Please install Bun by visiting: https://bun.sh");
  p.log.info("Run: curl -fsSL https://bun.sh/install | bash");
  p.cancel("Cannot continue without Bun.");
  process.exit(1);
}

let agentName = positional[0];

if (!agentName) {
  if (useDefaults) {
    agentName = "my-agent";
  } else {
    const name = await p.text({
      message: "What is your agent named?",
      placeholder: "my-agent",
      defaultValue: "my-agent",
      validate(value) {
        if (!value) return "Agent name is required.";
      },
    });
    if (p.isCancel(name)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
    agentName = name;
  }
}

// Generate agent name variations
const pkgName = sanitizePkgName(agentName); // e.g., "weather-bot" for package.json

const targetDir = resolve(process.cwd(), pkgName);

if (existsSync(targetDir)) {
  const contents = readdirSync(targetDir);
  if (contents.length > 0) {
    p.cancel(`Directory "${pkgName}" already exists and is not empty.`);
    process.exit(1);
  }
}

// Prompt for OPENAI_API_KEY (optional)
let openaiApiKey = "";
if (!useDefaults) {
  const apiKey = await p.text({
    message: "OpenAI API Key (optional, can be set later in .env.local):",
    placeholder: "sk-...",
    validate(value) {
      if (value && !value.startsWith("sk-")) {
        return "OpenAI API keys typically start with 'sk-'";
      }
    },
  });
  if (p.isCancel(apiKey)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }
  openaiApiKey = apiKey || "";
}

// Prompt for x402 payTo address (optional, can be skipped)
const DEFAULT_PAY_TO = "0x0799872E07EA7a63c79357694504FE66EDfE4a0A";
let payTo = DEFAULT_PAY_TO;
if (!useDefaults) {
  const payToInput = await p.text({
    message: "x402 payTo address (Ethereum address to receive payments, press Enter to skip):",
    placeholder: DEFAULT_PAY_TO,
    defaultValue: DEFAULT_PAY_TO,
    validate(value) {
      if (value && !value.startsWith("0x")) {
        return "Ethereum addresses must start with '0x'";
      }
    },
  });
  if (p.isCancel(payToInput)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }
  payTo = payToInput || DEFAULT_PAY_TO;
}

// Locate the templates directory relative to this script
const __filename = fileURLToPath(import.meta.url);
const templateDir = join(__filename, "..", "..", "templates", "default");

if (!existsSync(templateDir)) {
  p.cancel("Template directory not found. This is a bug in create-aixyz-app.");
  process.exit(1);
}

// Copy template files
mkdirSync(targetDir, { recursive: true });
cpSync(templateDir, targetDir, { recursive: true });

// Rename special files (npm strips .gitignore and .env.local)
const gitignoreSrc = join(targetDir, "gitignore");
if (existsSync(gitignoreSrc)) {
  renameSync(gitignoreSrc, join(targetDir, ".gitignore"));
}

const envLocalSrc = join(targetDir, "env.local");
if (existsSync(envLocalSrc)) {
  // Update .env.local with the API key if provided
  const envContent = openaiApiKey ? `OPENAI_API_KEY=${openaiApiKey}\n` : `OPENAI_API_KEY=\n`;
  writeFileSync(join(targetDir, ".env.local"), envContent);
  // Remove the template file after writing the new one
  if (envLocalSrc !== join(targetDir, ".env.local")) {
    renameSync(envLocalSrc, join(targetDir, ".env.local"));
  }
}

// Replace {{AGENT_NAME}} and {{PKG_NAME}} placeholders
const filesToReplace = ["package.json", "aixyz.config.ts"];
for (const file of filesToReplace) {
  const filePath = join(targetDir, file);
  if (existsSync(filePath)) {
    let content = readFileSync(filePath, "utf-8");
    content = content.replaceAll("{{PKG_NAME}}", pkgName);
    content = content.replaceAll("{{AGENT_NAME}}", agentName);
    content = content.replaceAll("{{PAY_TO}}", payTo);
    writeFileSync(filePath, content);
  }
}

// Install dependencies with Bun (always, regardless of which PM invoked this CLI)
const s = p.spinner();
s.start("Installing dependencies...");
try {
  execSync("bun install", { cwd: targetDir, stdio: "ignore" });
  s.stop("Dependencies installed.");
} catch {
  s.stop("Failed to install dependencies. You can run `bun install` manually.");
}

// Show warning if not using Bun
if (packageManager !== "bun" && packageManager !== "unknown") {
  p.log.warn("");
  p.log.error(`⚠️  You are using ${packageManager}, but this project requires Bun.`);
  p.log.error("   Please use Bun for this project: https://bun.sh");
  p.log.warn("");
}

p.note(
  [`cd ${pkgName}`, openaiApiKey ? "" : "Set OPENAI_API_KEY in .env.local", "bun run dev"].filter(Boolean).join("\n"),
  "Next steps",
);

p.note("aixyz erc-8004 register", "To register ERC-8004: Agent Identity");

p.outro(`Success! Created ${agentName} at ./${pkgName}`);
