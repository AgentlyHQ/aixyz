import { isAddress, type Chain } from "viem";
import { mainnet, sepolia, baseSepolia, foundry } from "viem/chains";
import { CHAIN_ID, getIdentityRegistryAddress } from "@agentlyhq/erc-8004";
import { select } from "@inquirer/prompts";
import { CliError } from "../utils.js";

export interface ChainConfig {
  chain: Chain;
  chainId: number;
}

export const CHAINS: Record<string, ChainConfig> = {
  mainnet: { chain: mainnet, chainId: CHAIN_ID.MAINNET },
  sepolia: { chain: sepolia, chainId: CHAIN_ID.SEPOLIA },
  "base-sepolia": { chain: baseSepolia, chainId: CHAIN_ID.BASE_SEPOLIA },
  localhost: { chain: foundry, chainId: 31337 },
};

export function resolveChainConfig(chainName: string): ChainConfig {
  const config = CHAINS[chainName];
  if (!config) {
    throw new CliError(`Unsupported chain: ${chainName}. Supported chains: ${Object.keys(CHAINS).join(", ")}`);
  }
  return config;
}

export async function selectChain(): Promise<string> {
  return select({
    message: "Select target chain:",
    choices: Object.keys(CHAINS).map((name) => ({ name, value: name })),
  });
}

export function resolveRegistryAddress(chainName: string, chainId: number, registry?: string): `0x${string}` {
  if (registry) {
    if (!isAddress(registry)) {
      throw new CliError(`Invalid registry address: ${registry}`);
    }
    return registry as `0x${string}`;
  }
  if (chainName === "localhost") {
    throw new CliError("--registry is required for localhost (no default contract deployment)");
  }
  return getIdentityRegistryAddress(chainId) as `0x${string}`;
}

export function validateBrowserRpcConflict(browser: boolean | undefined, rpcUrl: string | undefined): void {
  if (browser && rpcUrl) {
    throw new CliError("--rpc-url cannot be used with browser wallet. The browser wallet uses its own RPC endpoint.");
  }
}

export function getExplorerUrl(chain: Chain, txHash: string): string | null {
  const explorer = chain.blockExplorers?.default;
  if (!explorer) return null;
  return `${explorer.url}/tx/${txHash}`;
}
