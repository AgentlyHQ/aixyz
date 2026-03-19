import { execFile } from "node:child_process";

/**
 * Execute a Lightning Wallet CLI command and return parsed JSON output.
 * Requires `lightning-wallet-mcp` to be installed globally: npm i -g lightning-wallet-mcp
 */
export async function lw(args: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    execFile("lw", args, { timeout: 30_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`lw ${args.join(" ")} failed: ${stderr || error.message}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ raw: stdout.trim() });
      }
    });
  });
}
