import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

export function resolveUri(uri: string): string {
  // Return as-is for URLs (ipfs://, https://, data:, etc.)
  if (uri.startsWith("http://") || uri.startsWith("https://") || uri.startsWith("ipfs://") || uri.startsWith("data:")) {
    return uri;
  }

  // Check if it's a file path (ends with .json or exists as a file)
  if (uri.endsWith(".json") || existsSync(uri)) {
    const filePath = resolve(uri);

    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    if (!statSync(filePath).isFile()) {
      throw new Error(`Not a file: ${filePath}`);
    }

    const content = readFileSync(filePath, "utf-8");

    // Validate it's valid JSON
    try {
      JSON.parse(content);
    } catch {
      throw new Error(`Invalid JSON in file: ${filePath}`);
    }

    // Convert to base64 data URI
    const base64 = Buffer.from(content).toString("base64");
    return `data:application/json;base64,${base64}`;
  }

  // Return as-is for other URIs
  return uri;
}
