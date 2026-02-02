# @agentlyhq/erc-8004

Shared ERC-8004 contract ABIs, addresses, and Solidity sources for the Agently ecosystem.

## Overview

This package provides TypeScript exports for ERC-8004 registry contracts deployed on Sepolia and Base Sepolia testnets. It serves as a single source of truth for contract interfaces used across the monorepo.

## Installation

```bash
bun add @agentlyhq/erc-8004
# or
npm install @agentlyhq/erc-8004
# or
pnpm add @agentlyhq/erc-8004
```

For monorepo workspace usage:

```json
{
  "dependencies": {
    "@agentlyhq/erc-8004": "workspace:*"
  }
}
```

## Usage

### TypeScript / JavaScript

```typescript
import { IdentityRegistryAbi, ADDRESSES, CHAIN_ID, getIdentityRegistryAddress } from "@agentlyhq/erc-8004";

// Use with viem
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

const client = createPublicClient({
  chain: sepolia,
  transport: http(),
});

// Option 1: Use helper function
const address = getIdentityRegistryAddress(CHAIN_ID.SEPOLIA);

// Option 2: Access ADDRESSES directly
const addresses = ADDRESSES[CHAIN_ID.SEPOLIA];

const tokenURI = await client.readContract({
  address: addresses.identityRegistry,
  abi: IdentityRegistryAbi,
  functionName: "tokenURI",
  args: [1n],
});
```

### Solidity (Foundry)

Add the remapping to your `foundry.toml`:

```toml
remappings = [
  "@agentlyhq/erc-8004/=node_modules/@agentlyhq/erc-8004/"
]
```

Then import in your contracts:

```solidity
import { IdentityRegistryUpgradeable } from "@agentlyhq/erc-8004/contracts/IdentityRegistryUpgradeable.sol";
import { ReputationRegistryUpgradeable } from "@agentlyhq/erc-8004/contracts/ReputationRegistryUpgradeable.sol";
import { ValidationRegistryUpgradeable } from "@agentlyhq/erc-8004/contracts/ValidationRegistryUpgradeable.sol";
```

## Exports

### ABIs

| Export                  | Description                           |
| ----------------------- | ------------------------------------- |
| `IdentityRegistryAbi`   | ERC-721 based agent identity registry |
| `ReputationRegistryAbi` | Agent reputation/feedback registry    |
| `ValidationRegistryAbi` | Third-party agent validation registry |

Versioned ABIs are available for version pinning. See [CHANGELOG.md](./CHANGELOG.md) for details.

### Contract Addresses

```typescript
import { ADDRESSES, CHAIN_ID } from "@agentlyhq/erc-8004";

const sepolia = ADDRESSES[CHAIN_ID.SEPOLIA];
// sepolia.identityRegistry, sepolia.reputationRegistry, sepolia.validationRegistry
```

**Supported Chains:**

| Chain        | Chain ID | Constant                |
| ------------ | -------- | ----------------------- |
| Sepolia      | 11155111 | `CHAIN_ID.SEPOLIA`      |
| Base Sepolia | 84532    | `CHAIN_ID.BASE_SEPOLIA` |

**Proxy Addresses** (same on all supported chains):

| Contract             | Address                                      |
| -------------------- | -------------------------------------------- |
| `identityRegistry`   | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| `reputationRegistry` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| `validationRegistry` | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |

## References

- [ERC-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004)
- [erc-8004-contracts](https://github.com/erc-8004/erc-8004-contracts)
- [CHANGELOG.md](./CHANGELOG.md) - ABI version history and breaking changes
