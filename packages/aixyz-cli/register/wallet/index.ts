import { homedir } from "node:os";
import type { Chain, WalletClient } from "viem";
import { select, input, password } from "@inquirer/prompts";
import { withTTY } from "../utils/prompt";
import { createPrivateKeyWallet } from "./privatekey";
import { createKeystoreWallet } from "./keystore";

export interface WalletOptions {
  keystore?: string;
  browser?: boolean;
  broadcast?: boolean;
}

export type WalletMethod =
  | { type: "keystore"; path: string }
  | { type: "browser" }
  | { type: "privatekey"; resolveKey: () => Promise<string> };

export async function selectWalletMethod(options: WalletOptions): Promise<WalletMethod> {
  // Check explicit options first
  if (options.keystore) {
    return { type: "keystore", path: options.keystore };
  }
  if (options.browser) {
    return { type: "browser" };
  }

  // Check for PRIVATE_KEY environment variable
  const envPrivateKey = process.env.PRIVATE_KEY;
  if (envPrivateKey) {
    delete process.env.PRIVATE_KEY;
    console.warn("Warning: Using PRIVATE_KEY from environment variable");
    return { type: "privatekey", resolveKey: () => Promise.resolve(envPrivateKey) };
  }

  // Interactive: prompt user to choose
  return withTTY(async () => {
    const method = await select({
      message: "Select signing method:",
      choices: [
        { name: "Keystore file", value: "keystore" },
        { name: "Browser wallet (any EIP-6963 compatible wallets)", value: "browser" },
        { name: "Private key (not recommended)", value: "privatekey" },
      ],
    });

    switch (method) {
      case "keystore": {
        const keystorePath = await input({
          message: "Enter keystore path:",
          default: `${homedir()}/.foundry/keystores/default`,
        });
        return { type: "keystore", path: keystorePath };
      }
      case "browser":
        return { type: "browser" };
      case "privatekey": {
        const key = await password({
          message: "Enter private key:",
          mask: "*",
        });
        console.warn("Warning: Using raw private key is not recommended for production");
        return { type: "privatekey", resolveKey: () => Promise.resolve(key) };
      }
      default:
        throw new Error("No wallet method selected");
    }
  }, "No TTY detected. Provide --keystore, --browser, or PRIVATE_KEY environment variable to specify a signing method.");
}

export async function createWalletFromMethod(
  method: WalletMethod,
  chain: Chain,
  rpcUrl?: string,
): Promise<WalletClient> {
  switch (method.type) {
    case "privatekey":
      return createPrivateKeyWallet(await method.resolveKey(), chain, rpcUrl);
    case "keystore":
      return createKeystoreWallet(method.path, chain, rpcUrl);
    case "browser":
      throw new Error("Browser wallets should use registerWithBrowser, not createWalletFromMethod");
  }
}

export { createPrivateKeyWallet } from "./privatekey";
