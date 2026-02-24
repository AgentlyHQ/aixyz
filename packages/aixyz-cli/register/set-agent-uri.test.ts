import { describe, expect, test } from "bun:test";
import { CHAIN_ID, getIdentityRegistryAddress } from "@aixyz/erc-8004";
import { setAgentUri, validateAgentId } from "./set-agent-uri";

describe("set-agent-uri command chain configuration", () => {
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

describe("validateAgentId", () => {
  test("accepts 0", () => {
    expect(() => validateAgentId("0")).not.toThrow();
  });

  test("accepts positive integer", () => {
    expect(() => validateAgentId("42")).not.toThrow();
  });

  test("accepts large integer", () => {
    expect(() => validateAgentId("999999999")).not.toThrow();
  });

  test("rejects empty string", () => {
    expect(() => validateAgentId("")).toThrow("Invalid agent ID");
  });

  test("rejects whitespace-only string", () => {
    expect(() => validateAgentId("  ")).toThrow("Invalid agent ID");
  });

  test("accepts leading zeros", () => {
    expect(() => validateAgentId("007")).not.toThrow();
  });

  test("accepts single leading zero before digits", () => {
    expect(() => validateAgentId("042")).not.toThrow();
  });

  test("rejects negative number", () => {
    expect(() => validateAgentId("-1")).toThrow("Invalid agent ID");
  });

  test("rejects float", () => {
    expect(() => validateAgentId("1.5")).toThrow("Invalid agent ID");
  });

  test("rejects non-numeric string", () => {
    expect(() => validateAgentId("abc")).toThrow("Invalid agent ID");
  });

  test("rejects mixed string", () => {
    expect(() => validateAgentId("12abc")).toThrow("Invalid agent ID");
  });

  test("rejects Infinity", () => {
    expect(() => validateAgentId("Infinity")).toThrow("Invalid agent ID");
  });

  test("rejects NaN", () => {
    expect(() => validateAgentId("NaN")).toThrow("Invalid agent ID");
  });
});

describe("set-agent-uri command validation", () => {
  test("localhost requires --registry flag", async () => {
    await expect(
      setAgentUri({ agentId: "1", uri: "https://example.com/agent.json", chain: "localhost" }),
    ).rejects.toThrow("--registry is required for localhost");
  });

  test("rejects unsupported chain", async () => {
    await expect(
      setAgentUri({ agentId: "1", uri: "https://example.com/agent.json", chain: "fakenet" }),
    ).rejects.toThrow("Unsupported chain: fakenet");
  });

  test("rejects invalid registry address", async () => {
    await expect(
      setAgentUri({
        agentId: "1",
        uri: "https://example.com/agent.json",
        chain: "localhost",
        registry: "not-an-address",
      }),
    ).rejects.toThrow("Invalid registry address: not-an-address");
  });

  test("rejects --browser with --rpc-url", async () => {
    await expect(
      setAgentUri({
        agentId: "0",
        uri: "https://example.com/agent.json",
        chain: "sepolia",
        browser: true,
        rpcUrl: "http://localhost:8545",
      }),
    ).rejects.toThrow("--rpc-url cannot be used with browser wallet");
  });

  test("dry-run completes without wallet interaction when --broadcast is not set", async () => {
    await expect(
      setAgentUri({ agentId: "1", uri: "https://example.com/agent.json", chain: "sepolia" }),
    ).resolves.toBeUndefined();
  });

  test("rejects invalid agent ID (negative)", async () => {
    await expect(
      setAgentUri({ agentId: "-1", uri: "https://example.com/agent.json", chain: "sepolia" }),
    ).rejects.toThrow("Invalid agent ID");
  });

  test("rejects invalid agent ID (non-integer)", async () => {
    await expect(
      setAgentUri({ agentId: "abc", uri: "https://example.com/agent.json", chain: "sepolia" }),
    ).rejects.toThrow("Invalid agent ID");
  });

  test("rejects invalid agent ID (float)", async () => {
    await expect(
      setAgentUri({ agentId: "1.5", uri: "https://example.com/agent.json", chain: "sepolia" }),
    ).rejects.toThrow("Invalid agent ID");
  });

  test("accepts agent ID 0 as valid", async () => {
    // Agent ID 0 passes validation — triggers a later error (browser+rpc-url conflict)
    // proving the agent ID check did not reject it
    await expect(
      setAgentUri({
        agentId: "0",
        uri: "https://example.com/agent.json",
        chain: "sepolia",
        browser: true,
        rpcUrl: "http://localhost:8545",
      }),
    ).rejects.toThrow("--rpc-url cannot be used with browser wallet");
  });
});
