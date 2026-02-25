import { describe, expect, test } from "bun:test";
import { CHAIN_ID, getIdentityRegistryAddress } from "@aixyz/erc-8004";
import { deriveAgentUri } from "./utils/prompt";

describe("update command chain configuration", () => {
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

describe("deriveAgentUri", () => {
  test("appends /_aixyz/erc-8004.json to base URL", () => {
    expect(deriveAgentUri("https://my-agent.example.com")).toBe("https://my-agent.example.com/_aixyz/erc-8004.json");
  });

  test("strips trailing slash before appending", () => {
    expect(deriveAgentUri("https://my-agent.example.com/")).toBe("https://my-agent.example.com/_aixyz/erc-8004.json");
  });

  test("strips multiple trailing slashes", () => {
    expect(deriveAgentUri("https://my-agent.example.com///")).toBe("https://my-agent.example.com/_aixyz/erc-8004.json");
  });

  test("preserves path segments", () => {
    expect(deriveAgentUri("https://example.com/agents/my-agent")).toBe(
      "https://example.com/agents/my-agent/_aixyz/erc-8004.json",
    );
  });
});
