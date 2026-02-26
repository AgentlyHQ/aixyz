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
import { input, select } from "@inquirer/prompts";

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

// Priority-ordered chain IDs for interactive selection — most popular first.
const CHAIN_SELECTION_ORDER: number[] = [
  // Popular mainnets
  CHAIN_ID.MAINNET,
  CHAIN_ID.BASE,
  CHAIN_ID.ARBITRUM,
  CHAIN_ID.OPTIMISM,
  CHAIN_ID.POLYGON,
  CHAIN_ID.BSC,
  CHAIN_ID.AVALANCHE,
  CHAIN_ID.SCROLL,
  CHAIN_ID.LINEA,
  CHAIN_ID.CELO,
  CHAIN_ID.GNOSIS,
  CHAIN_ID.TAIKO,
  CHAIN_ID.MANTLE,
  CHAIN_ID.MONAD,
  CHAIN_ID.MEGAETH,
  CHAIN_ID.ABSTRACT,
  // Popular testnets
  CHAIN_ID.SEPOLIA,
  CHAIN_ID.BASE_SEPOLIA,
  CHAIN_ID.ARBITRUM_SEPOLIA,
  CHAIN_ID.OPTIMISM_SEPOLIA,
  CHAIN_ID.POLYGON_AMOY,
  CHAIN_ID.AVALANCHE_FUJI,
  CHAIN_ID.BSC_TESTNET,
  CHAIN_ID.SCROLL_SEPOLIA,
  CHAIN_ID.LINEA_SEPOLIA,
  CHAIN_ID.CELO_SEPOLIA,
  CHAIN_ID.MANTLE_SEPOLIA,
  CHAIN_ID.MONAD_TESTNET,
  CHAIN_ID.ABSTRACT_TESTNET,
  // Special
  31337,
];

const OTHER_CHAIN_ID = -1;

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

// Prompt user to select a chain interactively, returning the numeric chain ID.
// Chains are sorted by popularity. "Other" allows entering any custom chain ID.
export async function selectChain(): Promise<number> {
  const chainById = new Map(Object.values(CHAINS).map((c) => [c.chainId, c]));
  const nameById = new Map(Object.entries(CHAINS).map(([name, c]) => [c.chainId, name]));

  const choices = CHAIN_SELECTION_ORDER.filter((id) => chainById.has(id)).map((id) => ({
    name: `${nameById.get(id) ?? `chain-${id}`} (${id})`,
    value: id,
  }));
  choices.push({ name: "Other (enter chain ID)", value: OTHER_CHAIN_ID });

  const selected = await select({ message: "Select target chain:", choices });

  if (selected === OTHER_CHAIN_ID) {
    const raw = await input({
      message: "Enter chain ID:",
      validate: (v) => {
        const n = parseInt(v, 10);
        return Number.isInteger(n) && n > 0 ? true : "Must be a positive integer";
      },
    });
    return parseInt(raw, 10);
  }

  return selected;
}

// Returns the registry address if known, or null if no default exists for the chain (requires interactive prompt).
// Throws only for an explicitly invalid registry address.
export function resolveRegistryAddress(chainId: number, registry?: string): `0x${string}` | null {
  if (registry) {
    if (!isAddress(registry)) {
      throw new Error(`Invalid registry address: ${registry}`);
    }
    return registry as `0x${string}`;
  }
  if (chainId === 31337) {
    return null;
  }
  try {
    return getIdentityRegistryAddress(chainId) as `0x${string}`;
  } catch {
    return null;
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
