// =============================================================================
// ABIs (versioned) - Pin to specific version for stability
// =============================================================================

export { IdentityRegistryAbi_V1 } from "./abis/IdentityRegistry_V1";
export { IdentityRegistryAbi_V2 } from "./abis/IdentityRegistry_V2";

export { ReputationRegistryAbi_V1 } from "./abis/ReputationRegistry_V1";
export { ReputationRegistryAbi_V2 } from "./abis/ReputationRegistry_V2";
export { ReputationRegistryAbi_V3 } from "./abis/ReputationRegistry_V3";

export { ValidationRegistryAbi_V1 } from "./abis/ValidationRegistry_V1";

// =============================================================================
// ABIs (latest) - Convenience exports
// WARNING: These may introduce breaking changes. Pin to versioned exports for stability.
// =============================================================================

/** Use IdentityRegistryAbi_V2 to pin the current version. This export may change. */
export { IdentityRegistryAbi_V2 as IdentityRegistryAbi } from "./abis/IdentityRegistry_V2";

/** Use ReputationRegistryAbi_V3 to pin the current version. This export may change. */
export { ReputationRegistryAbi_V3 as ReputationRegistryAbi } from "./abis/ReputationRegistry_V3";

/** Use ValidationRegistryAbi_V1 to pin the current version. This export may change. */
export { ValidationRegistryAbi_V1 as ValidationRegistryAbi } from "./abis/ValidationRegistry_V1";

// Chain ID constants
export const CHAIN_ID = {
  // Mainnets
  MAINNET: 1,
  BASE: 8453,
  POLYGON: 137,
  SCROLL: 534352,
  MONAD: 143,
  BSC: 56,
  GNOSIS: 100,
  // Testnets
  SEPOLIA: 11155111,
  BASE_SEPOLIA: 84532,
  POLYGON_AMOY: 80002,
  SCROLL_SEPOLIA: 534351,
  MONAD_TESTNET: 10143,
  BSC_TESTNET: 97,
} as const;

export type SupportedChainId = (typeof CHAIN_ID)[keyof typeof CHAIN_ID];

// Contract addresses by chain
export const ADDRESSES = {
  // =============================================================================
  // Mainnets
  // =============================================================================
  [CHAIN_ID.MAINNET]: {
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
    // TODO: this contract address is not officially announced (found through deployment by same owner as the rest)
    validationRegistry: "0x8004Cc8439f36fd5F9F049D9fF86523Df6dAAB58",
  },
  [CHAIN_ID.BASE]: {
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
    // TODO: this contract address is not officially announced (found through deployment by same owner as the rest)
    validationRegistry: "0x8004Cc8439f36fd5F9F049D9fF86523Df6dAAB58",
  },
  [CHAIN_ID.POLYGON]: {
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
    // TODO: this contract address is not officially announced (found through deployment by same owner as the rest)
    validationRegistry: "0x8004Cc8439f36fd5F9F049D9fF86523Df6dAAB58",
  },
  [CHAIN_ID.SCROLL]: {
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
    // TODO: this contract address is not officially announced (found through deployment by same owner as the rest)
    validationRegistry: "0x8004Cc8439f36fd5F9F049D9fF86523Df6dAAB58",
  },
  [CHAIN_ID.MONAD]: {
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
    // TODO: this contract address is not officially announced (found through deployment by same owner as the rest)
    validationRegistry: "0x8004Cc8439f36fd5F9F049D9fF86523Df6dAAB58",
  },
  [CHAIN_ID.BSC]: {
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
    // TODO: this contract address is not officially announced (found through deployment by same owner as the rest)
    validationRegistry: "0x8004Cc8439f36fd5F9F049D9fF86523Df6dAAB58",
  },
  [CHAIN_ID.GNOSIS]: {
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
    // TODO: this contract address is not officially announced (found through deployment by same owner as the rest)
    validationRegistry: "0x8004Cc8439f36fd5F9F049D9fF86523Df6dAAB58",
  },
  // =============================================================================
  // Testnets
  // =============================================================================
  [CHAIN_ID.SEPOLIA]: {
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    validationRegistry: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
  },
  [CHAIN_ID.BASE_SEPOLIA]: {
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    validationRegistry: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
  },
  [CHAIN_ID.POLYGON_AMOY]: {
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    validationRegistry: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
  },
  [CHAIN_ID.SCROLL_SEPOLIA]: {
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    validationRegistry: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
  },
  [CHAIN_ID.MONAD_TESTNET]: {
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    validationRegistry: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
  },
  [CHAIN_ID.BSC_TESTNET]: {
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    validationRegistry: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
  },
} as const;

export type ContractAddresses = (typeof ADDRESSES)[SupportedChainId];

function isSupportedChainId(chainId: number): chainId is SupportedChainId {
  return Object.values(CHAIN_ID).includes(chainId as SupportedChainId);
}

// Helper function to get addresses by chain ID
export function getRegistryAddress(chainId: number): ContractAddresses {
  if (isSupportedChainId(chainId) === false) {
    throw new Error(`Unsupported chain ID: ${chainId}.`);
  }

  return ADDRESSES[chainId];
}

// Individual address getters
export function getIdentityRegistryAddress(chainId: number): string {
  return getRegistryAddress(chainId).identityRegistry;
}

export function getReputationRegistryAddress(chainId: number): string {
  return getRegistryAddress(chainId).reputationRegistry;
}

export function getValidationRegistryAddress(chainId: number): string {
  return getRegistryAddress(chainId).validationRegistry;
}

// Helper function to determine if a chain is mainnet
export function isMainnetChain(chainId: number): boolean {
  if (isSupportedChainId(chainId) === false) {
    throw new Error(`Unsupported chain ID: ${chainId}.`);
  }

  switch (chainId) {
    case CHAIN_ID.MAINNET:
    case CHAIN_ID.BASE:
    case CHAIN_ID.POLYGON:
    case CHAIN_ID.SCROLL:
    case CHAIN_ID.MONAD:
    case CHAIN_ID.BSC:
    case CHAIN_ID.GNOSIS:
      return true;
    default:
      return false;
  }
}
