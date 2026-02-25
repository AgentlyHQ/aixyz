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

| Chain     | Chain ID | Constant             |
| --------- | -------- | -------------------- |
| Abstract  | `2741`   | `CHAIN_ID.ABSTRACT`  |
| Arbitrum  | `42161`  | `CHAIN_ID.ARBITRUM`  |
| Avalanche | `43114`  | `CHAIN_ID.AVALANCHE` |
| Base      | `8453`   | `CHAIN_ID.BASE`      |
| BSC       | `56`     | `CHAIN_ID.BSC`       |
| Celo      | `42220`  | `CHAIN_ID.CELO`      |
| Gnosis    | `100`    | `CHAIN_ID.GNOSIS`    |
| Linea     | `59144`  | `CHAIN_ID.LINEA`     |
| Mainnet   | `1`      | `CHAIN_ID.MAINNET`   |
| Mantle    | `5000`   | `CHAIN_ID.MANTLE`    |
| MegaETH   | `4326`   | `CHAIN_ID.MEGAETH`   |
| Monad     | `143`    | `CHAIN_ID.MONAD`     |
| Optimism  | `10`     | `CHAIN_ID.OPTIMISM`  |
| Polygon   | `137`    | `CHAIN_ID.POLYGON`   |
| Scroll    | `534352` | `CHAIN_ID.SCROLL`    |
| Taiko     | `167000` | `CHAIN_ID.TAIKO`     |

**Testnets:**

| Chain            | Chain ID   | Constant                    |
| ---------------- | ---------- | --------------------------- |
| Abstract Testnet | `11124`    | `CHAIN_ID.ABSTRACT_TESTNET` |
| Arbitrum Sepolia | `421614`   | `CHAIN_ID.ARBITRUM_SEPOLIA` |
| Avalanche Fuji   | `43113`    | `CHAIN_ID.AVALANCHE_FUJI`   |
| Base Sepolia     | `84532`    | `CHAIN_ID.BASE_SEPOLIA`     |
| BSC Testnet      | `97`       | `CHAIN_ID.BSC_TESTNET`      |
| Celo Sepolia     | `11142220` | `CHAIN_ID.CELO_SEPOLIA`     |
| Linea Sepolia    | `59141`    | `CHAIN_ID.LINEA_SEPOLIA`    |
| Mantle Sepolia   | `5003`     | `CHAIN_ID.MANTLE_SEPOLIA`   |
| MegaETH Testnet  | `6342`     | `CHAIN_ID.MEGAETH_TESTNET`  |
| Monad Testnet    | `10143`    | `CHAIN_ID.MONAD_TESTNET`    |
| Optimism Sepolia | `11155420` | `CHAIN_ID.OPTIMISM_SEPOLIA` |
| Polygon Amoy     | `80002`    | `CHAIN_ID.POLYGON_AMOY`     |
| Scroll Sepolia   | `534351`   | `CHAIN_ID.SCROLL_SEPOLIA`   |
| Sepolia          | `11155111` | `CHAIN_ID.SEPOLIA`          |

## ABIs

| Export                  | Description                           |
| ----------------------- | ------------------------------------- |
| `IdentityRegistryAbi`   | ERC-721 based agent identity registry |
| `ReputationRegistryAbi` | Agent reputation/feedback registry    |
| `ValidationRegistryAbi` | Third-party agent validation registry |

Versioned ABIs (e.g. `IdentityRegistryAbi_V1`, `ReputationRegistryAbi_V3`) are available for pinning. See [CHANGELOG.md](./CHANGELOG.md) for details.

## Contract Addresses

All contracts use UUPS proxies. Addresses are consistent across all chains within each environment.

**Mainnets** (Abstract, Arbitrum, Avalanche, Base, BSC, Celo, Gnosis, Linea, Ethereum, Mantle, MegaETH, Monad, Optimism, Polygon, Scroll, Taiko):

| Contract             | Address                                      |
| -------------------- | -------------------------------------------- |
| `identityRegistry`   | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| `reputationRegistry` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| `validationRegistry` | `0x8004Cc8439f36fd5F9F049D9fF86523Df6dAAB58` |

**Testnets** (Abstract Testnet, Arbitrum Sepolia, Avalanche Fuji, Base Sepolia, BSC Testnet, Celo Sepolia, Linea Sepolia, Mantle Sepolia, MegaETH Testnet, Monad Testnet, Optimism Sepolia, Polygon Amoy, Scroll Sepolia, Sepolia):

| Contract             | Address                                      |
| -------------------- | -------------------------------------------- |
| `identityRegistry`   | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| `reputationRegistry` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| `validationRegistry` | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |

## References

- [ERC-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004)
- [erc-8004-contracts](https://github.com/erc-8004/erc-8004-contracts)
- [CHANGELOG.md](./CHANGELOG.md) - ABI version history and breaking changes
