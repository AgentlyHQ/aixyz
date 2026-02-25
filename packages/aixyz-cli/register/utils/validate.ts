import { isAddress } from "viem";

export function parseAgentId(agentId: string): bigint {
  const n = Number(agentId);
  if (agentId.trim() === "" || !Number.isInteger(n) || n < 0) {
    throw new Error(`Invalid agent ID: ${agentId}. Must be a non-negative integer.`);
  }
  return BigInt(agentId);
}

// as set in ReputationRegistryUpgradeable.sol
const MAX_INT128 = 10n ** 38n;

export function parseFeedbackValue(value: string): bigint {
  if (value.trim() === "" || !/^-?\d+$/.test(value.trim())) {
    throw new Error(`Invalid feedback value: ${value}. Must be a signed integer.`);
  }
  const parsed = BigInt(value.trim());
  if (parsed < -MAX_INT128 || parsed > MAX_INT128) {
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

export function parseFeedbackIndex(feedbackIndex: string): bigint {
  const n = Number(feedbackIndex);
  if (feedbackIndex.trim() === "" || !Number.isInteger(n) || n < 1) {
    throw new Error(`Invalid feedback index: ${feedbackIndex}. Must be a positive integer (1-indexed).`);
  }
  return BigInt(feedbackIndex);
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
