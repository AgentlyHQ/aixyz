import { createWalletClient, http, type Chain, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { validatePrivateKey } from "../utils.js";

export function createPrivateKeyWallet(privateKey: string, chain: Chain, rpcUrl?: string): WalletClient {
  const key = validatePrivateKey(privateKey);
  const account = privateKeyToAccount(key);

  return createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });
}
