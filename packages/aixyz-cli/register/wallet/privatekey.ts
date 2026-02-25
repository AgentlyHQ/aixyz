import { createWalletClient, http, type Chain, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CliError } from "../utils";

export function createPrivateKeyWallet(privateKey: string, chain: Chain, rpcUrl?: string): WalletClient {
  const key = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;

  let account;
  try {
    account = privateKeyToAccount(key);
  } catch {
    throw new CliError("Invalid private key format. Expected 64 hex characters (with or without 0x prefix).");
  }

  return createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });
}
