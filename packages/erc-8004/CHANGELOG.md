# Changelog

All notable changes to the `@agentlyhq/erc-8004` package will be documented in this file.

## v0.0.5

### Added

- `isMainnetChain(chainId)` helper function to determine if a given chain ID is a mainnet chain (Mainnet, Base, Polygon, Scroll, Monad, BSC, Gnosis)

---

## v0.0.4

### Added

- **New mainnet chains**: Base (8453), Polygon (137), Scroll (534352), Monad (143), BSC (56), Gnosis (100)
- **New testnet chains**: Polygon Amoy (80002), Scroll Sepolia (534351), Monad Testnet (10143), BSC Testnet (97)

### Changed

- `CHAIN_ID` constant now includes all 13 supported chains
- `ADDRESSES` object expanded with addresses for all new chains
- Updated README with comprehensive chain support tables

### Notes

Contract addresses are consistent across environments:

- All mainnets share the same proxy addresses
- All testnets share the same proxy addresses

---

## 26 Jan 2026

### Added

- New ABI versions from [erc-8004-contracts](https://github.com/erc-8004/erc-8004-contracts)
- Versioned ABI exports for backward compatibility

### Changed

- **IdentityRegistry**: `getAgentWallet()` return type changed from `bytes` to `address`
- **ReputationRegistry**: `value` type changed from `int256` to `int128`

---

## ABI Version Reference

### IdentityRegistry

| Export                   | Version | Key Difference                 |
| ------------------------ | ------- | ------------------------------ |
| `IdentityRegistryAbi_V2` | V2      | `getAgentWallet()` → `address` |
| `IdentityRegistryAbi_V1` | V1      | `getAgentWallet()` → `bytes`   |

**Breaking Change:**

```solidity
// V1 (IdentityRegistryAbi_V1)
function getAgentWallet(uint256 agentId) external view returns (bytes memory)

// V2 (IdentityRegistryAbi_V2)
function getAgentWallet(uint256 agentId) external view returns (address)

```

---

### ReputationRegistry

| Export                     | Version | Key Difference                                   |
| -------------------------- | ------- | ------------------------------------------------ |
| `ReputationRegistryAbi_V3` | V3      | `value` is `int128`                              |
| `ReputationRegistryAbi_V2` | V2      | `value` is `int256`, added `uint8 valueDecimals` |
| `ReputationRegistryAbi_V1` | V1      | `uint8` scores (0-100)                           |

**Breaking Change (V3 vs V2):**

`value` type changed from `int256` to `int128` in:

- `NewFeedback` event
- `giveFeedback()` function
- `readFeedback()` function
- `readAllFeedback()` function
- `getSummary()` function

```solidity
// V2 (ReputationRegistryAbi_V2)
event NewFeedback(... int256 value, uint8 valueDecimals, ...)
function giveFeedback(... int256 value, uint8 valueDecimals, ...)

// V3 (ReputationRegistryAbi_V3)
event NewFeedback(... int128 value, uint8 valueDecimals, ...)
function giveFeedback(... int128 value, uint8 valueDecimals, ...)
```

---

### ValidationRegistry

| Export                     | Version | Key Difference  |
| -------------------------- | ------- | --------------- |
| `ValidationRegistryAbi_V1` | V1      | Initial version |

---
