# @aixyz/erc-8004

TypeScript SDK for [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004), the decentralized agent registry standard. Provides contract ABIs, deployed addresses, and Zod schemas for agent registration and feedback files.

## Installation

```bash
bun add @aixyz/erc-8004
# or
npm install @aixyz/erc-8004
```

## Usage

### Contract Interaction

```typescript
import { IdentityRegistryAbi, ADDRESSES, CHAIN_ID } from "@aixyz/erc-8004";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

const client = createPublicClient({
  chain: sepolia,
  transport: http(),
});

const address = ADDRESSES[CHAIN_ID.SEPOLIA].identityRegistry;

const tokenURI = await client.readContract({
  address,
  abi: IdentityRegistryAbi,
  functionName: "tokenURI",
  args: [1n],
});
```

### Parsing Registration Files

```typescript
import { parseRawRegistrationFile, getServices, hasX402Support } from "@aixyz/erc-8004";

// Parse an existing file fetched from an agent's tokenURI
const result = parseRawRegistrationFile(fetchedData);
if (result.success) {
  const services = getServices(result.data);
  const supportsPayment = hasX402Support(result.data);
}
```

### Creating Registration Files

```typescript
import { validateRegistrationFile } from "@aixyz/erc-8004";

// Strict validation before on-chain submission — requires type literal and at least one service
const result = validateRegistrationFile(newFile);
if (!result.success) {
  console.error(result.error.issues);
}
```

### Parsing Feedback Files

```typescript
import { parseRawFeedbackFile } from "@aixyz/erc-8004";

const result = parseRawFeedbackFile(fetchedData);
if (result.success) {
  const { agentId, value, valueDecimals, clientAddress } = result.data;
}
```

### Solidity (Foundry)

```toml
# foundry.toml
remappings = ["@aixyz/erc-8004/=node_modules/@aixyz/erc-8004/"]
```

```solidity
import { IdentityRegistryUpgradeable } from "@aixyz/erc-8004/contracts/IdentityRegistryUpgradeable.sol";
import { ReputationRegistryUpgradeable } from "@aixyz/erc-8004/contracts/ReputationRegistryUpgradeable.sol";
import { ValidationRegistryUpgradeable } from "@aixyz/erc-8004/contracts/ValidationRegistryUpgradeable.sol";
```

## Supported Chains

**Mainnets:**

| Chain   | Chain ID | Constant           |
| ------- | -------- | ------------------ |
| Mainnet | `1`      | `CHAIN_ID.MAINNET` |
| Base    | `8453`   | `CHAIN_ID.BASE`    |
| Polygon | `137`    | `CHAIN_ID.POLYGON` |
| Scroll  | `534352` | `CHAIN_ID.SCROLL`  |
| Monad   | `143`    | `CHAIN_ID.MONAD`   |
| BSC     | `56`     | `CHAIN_ID.BSC`     |
| Gnosis  | `100`    | `CHAIN_ID.GNOSIS`  |

**Testnets:**

| Chain          | Chain ID   | Constant                  |
| -------------- | ---------- | ------------------------- |
| Sepolia        | `11155111` | `CHAIN_ID.SEPOLIA`        |
| Base Sepolia   | `84532`    | `CHAIN_ID.BASE_SEPOLIA`   |
| Polygon Amoy   | `80002`    | `CHAIN_ID.POLYGON_AMOY`   |
| Scroll Sepolia | `534351`   | `CHAIN_ID.SCROLL_SEPOLIA` |
| Monad Testnet  | `10143`    | `CHAIN_ID.MONAD_TESTNET`  |
| BSC Testnet    | `97`       | `CHAIN_ID.BSC_TESTNET`    |

## ABIs

| Export                  | Description                           |
| ----------------------- | ------------------------------------- |
| `IdentityRegistryAbi`   | ERC-721 based agent identity registry |
| `ReputationRegistryAbi` | Agent reputation/feedback registry    |
| `ValidationRegistryAbi` | Third-party agent validation registry |

Versioned ABIs (e.g. `IdentityRegistryAbi_V1`, `ReputationRegistryAbi_V3`) are available for pinning. See [CHANGELOG.md](./CHANGELOG.md) for details.

## Contract Addresses

All contracts use UUPS proxies. Addresses are consistent across all chains within each environment.

**Mainnets** (Ethereum, Base, Polygon, Scroll, Monad, BSC, Gnosis):

| Contract             | Address                                      |
| -------------------- | -------------------------------------------- |
| `identityRegistry`   | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| `reputationRegistry` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| `validationRegistry` | `0x8004Cc8439f36fd5F9F049D9fF86523Df6dAAB58` |

**Testnets** (Sepolia, Base Sepolia, Polygon Amoy, Scroll Sepolia, Monad Testnet, BSC Testnet):

| Contract             | Address                                      |
| -------------------- | -------------------------------------------- |
| `identityRegistry`   | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| `reputationRegistry` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| `validationRegistry` | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |

## References

- [ERC-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004)
- [erc-8004-contracts](https://github.com/erc-8004/erc-8004-contracts)
- [CHANGELOG.md](./CHANGELOG.md) - ABI version history and breaking changes
