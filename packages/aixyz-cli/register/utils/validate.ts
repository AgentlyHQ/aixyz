import { isAddress } from "viem";

export function parseAgentId(agentId: string): bigint {
  const trimmed = agentId.trim();
  if (trimmed === "" || !/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid agent ID: ${agentId}. Must be a non-negative integer.`);
  }
  return BigInt(trimmed);
}

// as set in ReputationRegistryUpgradeable.sol (maximum absolute feedback value)
const MAX_ABS_VALUE = 10n ** 38n;

export function parseFeedbackValue(value: string): bigint {
  if (value.trim() === "" || !/^-?\d+$/.test(value.trim())) {
    throw new Error(`Invalid feedback value: ${value}. Must be a signed integer.`);
  }
  const parsed = BigInt(value.trim());
  if (parsed < -MAX_ABS_VALUE || parsed > MAX_ABS_VALUE) {
    throw new Error(`Invalid feedback value: ${value}. Must be between -1e38 and 1e38.`);
  }
  return parsed;
}

export function parseValueDecimals(valueDecimals: string): number {
  const n = Number(valueDecimals);
  if (valueDecimals.trim() === "" || !Number.isInteger(n) || n < 0 || n > 18) {
    throw new Error(`Invalid value decimals: ${valueDecimals}. Must be an integer between 0 and 18.`);
  }
  return n;
}

const MAX_UINT64 = (1n << 64n) - 1n;

export function parseFeedbackIndex(feedbackIndex: string): bigint {
  const trimmed = feedbackIndex.trim();
  if (trimmed === "" || !/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid feedback index: ${feedbackIndex}. Must be a positive integer (1-indexed).`);
  }
  const parsed = BigInt(trimmed);
  if (parsed < 1n || parsed > MAX_UINT64) {
    throw new Error(`Invalid feedback index: ${feedbackIndex}. Must be between 1 and 2^64-1 (1-indexed).`);
  }
  return parsed;
}

export function parseClientAddress(address: string): `0x${string}` {
  if (!isAddress(address)) {
    throw new Error(`Invalid client address: ${address}. Must be a valid Ethereum address.`);
  }
  return address as `0x${string}`;
}

export function parseBytes32Hash(hash: string, fieldName: string): `0x${string}` {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error(`Invalid ${fieldName}: ${hash}. Must be a 32-byte hex string (0x followed by 64 hex characters).`);
  }
  return hash as `0x${string}`;
}

// Backwards-compatible aliases (validate-only, no return value)
export const validateAgentId = (v: string) => void parseAgentId(v);
export const validateFeedbackValue = (v: string) => void parseFeedbackValue(v);
export const validateValueDecimals = (v: string) => void parseValueDecimals(v);
export const validateFeedbackIndex = (v: string) => void parseFeedbackIndex(v);
export const validateClientAddress = (v: string) => void parseClientAddress(v);
export const validateBytes32Hash = (h: string, f: string) => void parseBytes32Hash(h, f);
