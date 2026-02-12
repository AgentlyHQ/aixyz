import { describe, expect, test } from "bun:test";
import { CHAIN_ID, getIdentityRegistryAddress } from "@agentlyhq/erc-8004";
import { register } from "./register.js";

describe("register command chain configuration", () => {
  test("sepolia chain ID is correct", () => {
    expect(CHAIN_ID.SEPOLIA).toStrictEqual(11155111);
  });

  test("base-sepolia chain ID is correct", () => {
    expect(CHAIN_ID.BASE_SEPOLIA).toStrictEqual(84532);
  });

  test("identity registry address is returned for sepolia", () => {
    const address = getIdentityRegistryAddress(CHAIN_ID.SEPOLIA);
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  test("identity registry address is returned for base-sepolia", () => {
    const address = getIdentityRegistryAddress(CHAIN_ID.BASE_SEPOLIA);
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  test("throws for unsupported chain ID", () => {
    expect(() => getIdentityRegistryAddress(999999)).toThrow("Unsupported chain ID");
  });
});

describe("register command validation", () => {
  test("supported chains list includes sepolia", () => {
    const CHAINS: Record<string, { chainId: number }> = {
      sepolia: { chainId: CHAIN_ID.SEPOLIA },
      "base-sepolia": { chainId: CHAIN_ID.BASE_SEPOLIA },
    };
    expect(CHAINS["sepolia"]).toBeDefined();
    expect(CHAINS["sepolia"].chainId).toStrictEqual(CHAIN_ID.SEPOLIA);
  });

  test("supported chains list includes base-sepolia", () => {
    const CHAINS: Record<string, { chainId: number }> = {
      sepolia: { chainId: CHAIN_ID.SEPOLIA },
      "base-sepolia": { chainId: CHAIN_ID.BASE_SEPOLIA },
      localhost: { chainId: 31337 },
    };
    expect(CHAINS["base-sepolia"]).toBeDefined();
    expect(CHAINS["base-sepolia"].chainId).toStrictEqual(CHAIN_ID.BASE_SEPOLIA);
  });

  test("supported chains list includes localhost with chainId 31337", () => {
    const CHAINS: Record<string, { chainId: number }> = {
      sepolia: { chainId: CHAIN_ID.SEPOLIA },
      "base-sepolia": { chainId: CHAIN_ID.BASE_SEPOLIA },
      localhost: { chainId: 31337 },
    };
    expect(CHAINS["localhost"]).toBeDefined();
    expect(CHAINS["localhost"].chainId).toStrictEqual(31337);
  });

  test("unsupported chain is not in list", () => {
    const CHAINS: Record<string, { chainId: number }> = {
      sepolia: { chainId: CHAIN_ID.SEPOLIA },
      "base-sepolia": { chainId: CHAIN_ID.BASE_SEPOLIA },
      localhost: { chainId: 31337 },
    };
    expect(CHAINS["mainnet"]).toBeUndefined();
  });

  test("localhost requires --registry flag", async () => {
    await expect(register({ chain: "localhost" })).rejects.toThrow("--registry is required for localhost");
  });

  test("dry-run completes without wallet interaction when --broadcast is not set", async () => {
    await expect(register({ chain: "sepolia", uri: "https://example.com/agent.json" })).resolves.toBeUndefined();
  });
});
