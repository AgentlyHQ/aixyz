import { checkbox, confirm, input, select } from "@inquirer/prompts";
import type { RegistrationEntry } from "@aixyz/erc-8004/schemas/registration";

export async function promptAgentUrl(): Promise<string> {
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
    const yes = await confirm({
      message: `Update this registration? (agentId: ${reg.agentId}, registry: ${reg.agentRegistry})`,
      default: true,
    });
    if (!yes) {
      throw new Error("Aborted.");
    }
    return reg;
  }

  return select({
    message: "Select registration to update:",
    choices: registrations.map((reg) => ({
      name: `agentId: ${reg.agentId} — ${reg.agentRegistry}`,
      value: reg,
    })),
  });
}

export function deriveAgentUri(url: string): string {
  // Ensure no trailing slash before appending path
  const base = url.replace(/\/+$/, "");
  return `${base}/_aixyz/erc-8004.json`;
}
