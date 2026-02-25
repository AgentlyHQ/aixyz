import { isAddress, defineChain, type Chain } from "viem";
import {
  abstract,
  abstractTestnet,
  arbitrum,
  arbitrumSepolia,
  avalanche,
  avalancheFuji,
  base,
  baseSepolia,
  bsc,
  bscTestnet,
  celo,
  celoSepolia,
  foundry,
  gnosis,
  linea,
  lineaSepolia,
  mainnet,
  mantle,
  mantleSepoliaTestnet,
  megaeth,
  monad,
  monadTestnet,
  optimism,
  optimismSepolia,
  polygon,
  polygonAmoy,
  scroll,
  scrollSepolia,
  sepolia,
  taiko,
} from "viem/chains";
import { CHAIN_ID, getIdentityRegistryAddress } from "@aixyz/erc-8004";
import { select } from "@inquirer/prompts";

export interface ChainConfig {
  chain: Chain;
  chainId: number;
}

// Maps supported chain IDs to viem Chain objects (derived from @aixyz/erc-8004 CHAIN_ID)
const VIEM_CHAIN_BY_ID: Record<number, Chain> = {
  [CHAIN_ID.ABSTRACT]: abstract,
  [CHAIN_ID.ARBITRUM]: arbitrum,
  [CHAIN_ID.AVALANCHE]: avalanche,
  [CHAIN_ID.BASE]: base,
  [CHAIN_ID.BSC]: bsc,
  [CHAIN_ID.CELO]: celo,
  [CHAIN_ID.GNOSIS]: gnosis,
  [CHAIN_ID.LINEA]: linea,
  [CHAIN_ID.MAINNET]: mainnet,
  [CHAIN_ID.MANTLE]: mantle,
  [CHAIN_ID.MEGAETH]: megaeth,
  [CHAIN_ID.MONAD]: monad,
  [CHAIN_ID.OPTIMISM]: optimism,
  [CHAIN_ID.POLYGON]: polygon,
  [CHAIN_ID.SCROLL]: scroll,
  [CHAIN_ID.TAIKO]: taiko,
  [CHAIN_ID.ABSTRACT_TESTNET]: abstractTestnet,
  [CHAIN_ID.ARBITRUM_SEPOLIA]: arbitrumSepolia,
  [CHAIN_ID.AVALANCHE_FUJI]: avalancheFuji,
  [CHAIN_ID.BASE_SEPOLIA]: baseSepolia,
  [CHAIN_ID.BSC_TESTNET]: bscTestnet,
  [CHAIN_ID.CELO_SEPOLIA]: celoSepolia,
  [CHAIN_ID.LINEA_SEPOLIA]: lineaSepolia,
  [CHAIN_ID.MANTLE_SEPOLIA]: mantleSepoliaTestnet,
  [CHAIN_ID.MONAD_TESTNET]: monadTestnet,
  [CHAIN_ID.OPTIMISM_SEPOLIA]: optimismSepolia,
  [CHAIN_ID.POLYGON_AMOY]: polygonAmoy,
  [CHAIN_ID.SCROLL_SEPOLIA]: scrollSepolia,
  [CHAIN_ID.SEPOLIA]: sepolia,
  31337: foundry,
};

// Build CHAINS from CHAIN_ID as the single source of truth from @aixyz/erc-8004.
// Chain names are derived from CHAIN_ID keys: lowercase with underscores replaced by hyphens.
export const CHAINS: Record<string, ChainConfig> = {
  ...Object.fromEntries(
    (Object.entries(CHAIN_ID) as [string, number][])
      .filter(([, id]) => id in VIEM_CHAIN_BY_ID)
      .map(([key, id]) => [key.toLowerCase().replace(/_/g, "-"), { chain: VIEM_CHAIN_BY_ID[id]!, chainId: id }]),
  ),
  localhost: { chain: foundry, chainId: 31337 },
};

export function resolveChainConfig(chainName: string): ChainConfig {
  const config = CHAINS[chainName];
  if (!config) {
    throw new Error(`Unsupported chain: ${chainName}. Supported chains: ${Object.keys(CHAINS).join(", ")}`);
  }
  return config;
}

// Resolve chain config by numeric chain ID, supporting BYO chains via rpcUrl.
// For known chain IDs the viem chain object is used directly.
// For unknown chain IDs, a minimal chain is constructed using defineChain (requires rpcUrl).
export function resolveChainConfigById(chainId: number, rpcUrl?: string): ChainConfig {
  const chain = VIEM_CHAIN_BY_ID[chainId];
  if (chain) {
    return { chain, chainId };
  }
  if (!rpcUrl) {
    throw new Error(`Unknown chain ID ${chainId}. Provide --rpc-url to register on a custom chain.`);
  }
  return {
    chain: defineChain({
      id: chainId,
      name: `chain-${chainId}`,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    }),
    chainId,
  };
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
      throw new Error(`Invalid registry address: ${registry}`);
    }
    return registry as `0x${string}`;
  }
  if (chainName === "localhost") {
    throw new Error("--registry is required for localhost (no default contract deployment)");
  }
  try {
    return getIdentityRegistryAddress(chainId) as `0x${string}`;
  } catch {
    throw new Error(`--registry is required for chain ID ${chainId} (no default contract deployment)`);
  }
}

export function validateBrowserRpcConflict(browser: boolean | undefined, rpcUrl: string | undefined): void {
  if (browser && rpcUrl) {
    throw new Error("--rpc-url cannot be used with browser wallet. The browser wallet uses its own RPC endpoint.");
  }
}

export function getExplorerUrl(chain: Chain, txHash: string): string | null {
  const explorer = chain.blockExplorers?.default;
  if (!explorer) return null;
  return `${explorer.url}/tx/${txHash}`;
}
