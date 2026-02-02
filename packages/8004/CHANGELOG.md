# Changelog

All notable changes to the `@agentlyhq/erc-8004` package will be documented in this file.

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

## Contract Addresses

### Proxy Addresses (UUPS)

Same on all supported chains (Sepolia, Base Sepolia):

| Contract           | Proxy Address                                |
| ------------------ | -------------------------------------------- |
| IdentityRegistry   | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| ValidationRegistry | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |

> **Note:** Implementation addresses may change after contract upgrades. Always use proxy addresses for interactions.
