// ethers is used solely for V3 keystore decryption — viem does not support this.
import { decryptKeystoreJson, isKeystoreJson } from "ethers";
import { createWalletClient, http, type Chain, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { password } from "@inquirer/prompts";
import { CliError } from "../utils.js";

export async function decryptKeystore(keystorePath: string): Promise<`0x${string}`> {
  const file = Bun.file(keystorePath);
  if (!(await file.exists())) {
    throw new CliError(`Keystore file not found: ${keystorePath}`);
  }

  const json = await file.text();
  if (!isKeystoreJson(json)) {
    throw new CliError(`Invalid keystore file: ${keystorePath}`);
  }
  const pass = await password({ message: "Enter keystore password:", mask: "*" });
  const account = await decryptKeystoreJson(json, pass);

  return account.privateKey as `0x${string}`;
}

export async function createKeystoreWallet(keystorePath: string, chain: Chain, rpcUrl?: string): Promise<WalletClient> {
  const privateKey = await decryptKeystore(keystorePath);
  const account = privateKeyToAccount(privateKey);

  return createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });
}
