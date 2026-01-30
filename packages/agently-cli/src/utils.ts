import { existsSync, readFileSync, statSync } from "fs";
import { resolve } from "path";

export function resolveUri(uri: string): string {
  // Return as-is for URLs (ipfs://, https://, data:, etc.)
  if (uri.startsWith("http://") || uri.startsWith("https://") || uri.startsWith("ipfs://") || uri.startsWith("data:")) {
    return uri;
  }

  // Check if it's a file path (ends with .json or exists as a file)
  if (uri.endsWith(".json") || existsSync(uri)) {
    const filePath = resolve(uri);

    if (!existsSync(filePath)) {
      throw new CliError(`File not found: ${filePath}`);
    }

    if (!statSync(filePath).isFile()) {
      throw new CliError(`Not a file: ${filePath}`);
    }

    const content = readFileSync(filePath, "utf-8");

    // Validate it's valid JSON
    try {
      JSON.parse(content);
    } catch {
      throw new CliError(`Invalid JSON in file: ${filePath}`);
    }

    // Convert to base64 data URI
    const base64 = Buffer.from(content).toString("base64");
    return `data:application/json;base64,${base64}`;
  }

  // Return as-is for other URIs
  return uri;
}

export function validatePrivateKey(key: string): `0x${string}` {
  const normalizedKey = key.startsWith("0x") ? key : `0x${key}`;

  if (!/^0x[0-9a-fA-F]{64}$/.test(normalizedKey)) {
    throw new CliError("Invalid private key format. Expected 64 hex characters (with or without 0x prefix).");
  }

  return normalizedKey as `0x${string}`;
}

export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}
