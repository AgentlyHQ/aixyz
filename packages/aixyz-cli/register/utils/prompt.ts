import { isAddress } from "viem";
import { input } from "@inquirer/prompts";

export async function promptAgentId(): Promise<string> {
  return input({
    message: "Agent ID (token ID) to update:",
    validate: (value) => {
      const n = Number(value);
      if (value.trim() === "" || !Number.isInteger(n) || n < 0) return "Must be a non-negative integer";
      return true;
    },
  });
}

export async function promptUri(): Promise<string> {
  return input({
    message: "New agent metadata URI or path to .json file (leave empty to clear):",
  });
}

export async function promptFeedbackValue(): Promise<string> {
  return input({
    message: "Feedback value (signed integer, -1e38 to 1e38):",
    validate: (value) => {
      if (value.trim() === "" || !/^-?\d+$/.test(value.trim())) return "Must be a signed integer";
      const parsed = BigInt(value.trim());
      const limit = 10n ** 38n;
      if (parsed < -limit || parsed > limit) return "Must be between -1e38 and 1e38";
      return true;
    },
  });
}

export async function promptValueDecimals(): Promise<string> {
  return input({
    message: "Value decimals (0-18):",
    default: "0",
    validate: (value) => {
      const n = Number(value);
      if (value.trim() === "" || !Number.isInteger(n) || n < 0 || n > 18) return "Must be an integer between 0 and 18";
      return true;
    },
  });
}

export async function promptFeedbackIndex(): Promise<string> {
  return input({
    message: "Feedback index (1-indexed):",
    validate: (value) => {
      const trimmed = value.trim();
      if (trimmed === "") return "Must be a positive integer (1-indexed)";
      if (!/^\d+$/.test(trimmed)) return "Must be a positive integer (1-indexed)";
      const parsed = BigInt(trimmed);
      const maxUint64 = (1n << 64n) - 1n;
      if (parsed < 1n || parsed > maxUint64) return "Must be between 1 and 2^64-1 (1-indexed)";
      return true;
    },
  });
}

export async function promptClientAddress(): Promise<string> {
  return input({
    message: "Client address (Ethereum address):",
    validate: (value) => {
      if (!isAddress(value)) return "Must be a valid Ethereum address";
      return true;
    },
  });
}

export async function promptResponseUri(): Promise<string> {
  return input({
    message: "Response URI:",
    validate: (value) => {
      if (value.trim() === "") return "Response URI must not be empty";
      return true;
    },
  });
}
