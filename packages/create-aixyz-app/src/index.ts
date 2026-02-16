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

p.intro("Create AIXYZ App");

let projectName = positional[0];

if (!projectName) {
  if (useDefaults) {
    projectName = "my-agent";
  } else {
    const name = await p.text({
      message: "What is your project named?",
      placeholder: "my-agent",
      defaultValue: "my-agent",
      validate(value) {
        if (!value) return "Project name is required.";
        if (!/^[a-z0-9-]+$/.test(value)) return "Project name must be lowercase alphanumeric with hyphens only.";
      },
    });
    if (p.isCancel(name)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
    projectName = name;
  }
}

const targetDir = resolve(process.cwd(), projectName);

if (existsSync(targetDir)) {
  const contents = readdirSync(targetDir);
  if (contents.length > 0) {
    p.cancel(`Directory "${projectName}" already exists and is not empty.`);
    process.exit(1);
  }
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
  renameSync(envLocalSrc, join(targetDir, ".env.local"));
}

// Replace {{PROJECT_NAME}} placeholders
const filesToReplace = ["package.json", "aixyz.config.ts"];
for (const file of filesToReplace) {
  const filePath = join(targetDir, file);
  if (existsSync(filePath)) {
    const content = readFileSync(filePath, "utf-8");
    writeFileSync(filePath, content.replaceAll("{{PROJECT_NAME}}", projectName));
  }
}

// Install dependencies
const s = p.spinner();
s.start("Installing dependencies...");
try {
  execSync("bun install", { cwd: targetDir, stdio: "ignore" });
  s.stop("Dependencies installed.");
} catch {
  s.stop("Failed to install dependencies. You can run `bun install` manually.");
}

// Initialize git
s.start("Initializing git...");
try {
  execSync("git init", { cwd: targetDir, stdio: "ignore" });
  execSync("git add -A", { cwd: targetDir, stdio: "ignore" });
  execSync('git commit -m "Initial commit from create-aixyz-app"', { cwd: targetDir, stdio: "ignore" });
  s.stop("Git initialized.");
} catch {
  s.stop("Failed to initialize git. You can run `git init` manually.");
}

p.note([`cd ${projectName}`, "Set OPENAI_API_KEY in .env.local", "bun run dev"].join("\n"), "Next steps");

p.outro(`Success! Created ${projectName} at ./${projectName}`);
