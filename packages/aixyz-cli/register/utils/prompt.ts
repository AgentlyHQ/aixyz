import { checkbox, confirm, input, select } from "@inquirer/prompts";
import { isAddress } from "viem";
import type { RegistrationEntry } from "@aixyz/erc-8004/schemas/registration";

export function isTTY(): boolean {
  return Boolean(process.stdin.isTTY);
}

export async function withTTY<T>(fn: () => Promise<T>, nonTtyMessage: string): Promise<T> {
  if (!isTTY()) {
    throw new Error(nonTtyMessage);
  }
  return fn();
}

export async function promptAgentUrl(): Promise<string> {
  return withTTY(
    () =>
      input({
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
      }),
    "No TTY detected. Provide --url to specify the agent deployment URL.",
  );
}

export async function promptSupportedTrust(): Promise<string[]> {
  return withTTY(
    () =>
      checkbox({
        message: "Select supported trust mechanisms:",
        choices: [
          { name: "reputation", value: "reputation", checked: true },
          { name: "crypto-economic", value: "crypto-economic" },
          { name: "tee-attestation", value: "tee-attestation" },
          { name: "social", value: "social" },
          { name: "governance", value: "governance" },
        ],
        required: true,
      }),
    `No TTY detected. Provide --supported-trust to specify trust mechanisms (e.g., --supported-trust "reputation,tee-attestation").`,
  );
}

const VALID_TRUST_MECHANISMS = ["reputation", "crypto-economic", "tee-attestation", "social", "governance"] as const;

export function parseSupportedTrust(value: string): string[] {
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const invalid = items.filter((i) => !(VALID_TRUST_MECHANISMS as readonly string[]).includes(i));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid trust mechanism(s): ${invalid.join(", ")}. Valid values: ${VALID_TRUST_MECHANISMS.join(", ")}`,
    );
  }
  if (items.length === 0) {
    throw new Error("--supported-trust requires at least one value.");
  }
  return items;
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

  return withTTY(
    () =>
      select({
        message: "Select registration to update:",
        choices: registrations.map((reg) => ({
          name: `agentId: ${reg.agentId} — ${reg.agentRegistry}`,
          value: reg,
        })),
      }),
    "No TTY detected. Multiple registrations found in app/erc-8004.ts; cannot select one non-interactively.",
  );
}

export async function promptRegistryAddress(): Promise<`0x${string}`> {
  return withTTY(async () => {
    const value = await input({
      message: "IdentityRegistry contract address (no default for this chain):",
      validate: (v) => (isAddress(v) ? true : "Must be a valid Ethereum address (0x…)"),
    });
    return value as `0x${string}`;
  }, "No TTY detected. Provide --registry to specify the IdentityRegistry contract address.");
}

export function deriveAgentUri(url: string): string {
  // Ensure no trailing slash before appending path
  const base = url.replace(/\/+$/, "");
  return `${base}/_aixyz/erc-8004.json`;
}
