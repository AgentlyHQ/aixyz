import { checkbox, confirm, input, select } from "@inquirer/prompts";
import { isAddress } from "viem";
import type { RegistrationEntry } from "@aixyz/erc-8004/schemas/registration";

export function isTTY(): boolean {
  return Boolean(process.stdin.isTTY);
}

export async function promptAgentUrl(): Promise<string> {
  if (!isTTY()) {
    throw new Error("No TTY detected. Provide --url to specify the agent deployment URL.");
  }
  return input({
    message: "Agent deployment URL (e.g., https://my-agent.example.com):",
    validate: (value) => {
      try {
        const url = new URL(value);
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          return "URL must start with https:// or http://";
        }
        return true;
      } catch {
        return "Must be a valid URL (e.g., https://my-agent.example.com)";
      }
    },
  });
}

export async function promptSupportedTrust(): Promise<string[]> {
  if (!isTTY()) {
    throw new Error("No TTY detected. Create app/erc-8004.ts manually or run this command in an interactive terminal.");
  }
  return checkbox({
    message: "Select supported trust mechanisms:",
    choices: [
      { name: "reputation", value: "reputation", checked: true },
      { name: "crypto-economic", value: "crypto-economic" },
      { name: "tee-attestation", value: "tee-attestation" },
      { name: "social", value: "social" },
      { name: "governance", value: "governance" },
    ],
    required: true,
  });
}

export async function promptSelectRegistration(registrations: RegistrationEntry[]): Promise<RegistrationEntry> {
  if (registrations.length === 1) {
    const reg = registrations[0]!;
    if (!isTTY()) {
      return reg;
    }
    const yes = await confirm({
      message: `Update this registration? (agentId: ${reg.agentId}, registry: ${reg.agentRegistry})`,
      default: true,
    });
    if (!yes) {
      throw new Error("Aborted.");
    }
    return reg;
  }

  if (!isTTY()) {
    throw new Error(
      "No TTY detected. Multiple registrations found in app/erc-8004.ts; cannot select one non-interactively.",
    );
  }

  return select({
    message: "Select registration to update:",
    choices: registrations.map((reg) => ({
      name: `agentId: ${reg.agentId} — ${reg.agentRegistry}`,
      value: reg,
    })),
  });
}

export async function promptRegistryAddress(): Promise<`0x${string}`> {
  if (!isTTY()) {
    throw new Error("No TTY detected. Provide --registry to specify the IdentityRegistry contract address.");
  }
  const value = await input({
    message: "IdentityRegistry contract address (no default for this chain):",
    validate: (v) => (isAddress(v) ? true : "Must be a valid Ethereum address (0x…)"),
  });
  return value as `0x${string}`;
}

export function deriveAgentUri(url: string): string {
  // Ensure no trailing slash before appending path
  const base = url.replace(/\/+$/, "");
  return `${base}/_aixyz/erc-8004.json`;
}
