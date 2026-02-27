import { describe, expect, test } from "bun:test";
import { CHAIN_ID, getIdentityRegistryAddress } from "@aixyz/erc-8004";
import {
  deriveAgentUri,
  isTTY,
  parseSupportedTrust,
  promptAgentUrl,
  promptRegistryAddress,
  promptSupportedTrust,
} from "./utils/prompt";
import { selectChain } from "./utils/chain";

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

describe("parseSupportedTrust", () => {
  test("parses a single value", () => {
    expect(parseSupportedTrust("reputation")).toStrictEqual(["reputation"]);
  });

  test("parses multiple comma-separated values", () => {
    expect(parseSupportedTrust("reputation,tee-attestation")).toStrictEqual(["reputation", "tee-attestation"]);
  });

  test("trims whitespace around values", () => {
    expect(parseSupportedTrust("reputation, tee-attestation , social")).toStrictEqual([
      "reputation",
      "tee-attestation",
      "social",
    ]);
  });

  test("throws for invalid trust mechanism", () => {
    expect(() => parseSupportedTrust("reputation,invalid")).toThrow("Invalid trust mechanism(s): invalid");
  });

  test("throws for empty string", () => {
    expect(() => parseSupportedTrust("")).toThrow("--supported-trust requires at least one value");
  });

  test("accepts all valid mechanisms", () => {
    expect(parseSupportedTrust("reputation,crypto-economic,tee-attestation,social,governance")).toStrictEqual([
      "reputation",
      "crypto-economic",
      "tee-attestation",
      "social",
      "governance",
    ]);
  });
});

describe("isTTY", () => {
  test("returns a boolean", () => {
    expect(typeof isTTY()).toBe("boolean");
  });
});

describe("TTY-gated prompts throw in non-interactive environments", () => {
  // Tests run in a piped (non-TTY) environment, so these error paths are exercised directly.

  async function withNoTTY<T>(fn: () => Promise<T>): Promise<T> {
    const originalIsTTY = process.stdin.isTTY;
    (process.stdin as NodeJS.ReadStream & { isTTY: boolean | undefined }).isTTY = undefined;
    try {
      return await fn();
    } finally {
      (process.stdin as NodeJS.ReadStream & { isTTY: boolean | undefined }).isTTY = originalIsTTY;
    }
  }

  test("promptAgentUrl throws when stdin is not a TTY", async () => {
    await withNoTTY(async () => {
      await expect(promptAgentUrl()).rejects.toThrow("No TTY detected. Provide --url");
    });
  });

  test("promptSupportedTrust throws when stdin is not a TTY", async () => {
    await withNoTTY(async () => {
      await expect(promptSupportedTrust()).rejects.toThrow("No TTY detected");
    });
  });

  test("promptRegistryAddress throws when stdin is not a TTY", async () => {
    await withNoTTY(async () => {
      await expect(promptRegistryAddress()).rejects.toThrow("No TTY detected. Provide --registry");
    });
  });

  test("selectChain throws when stdin is not a TTY", async () => {
    await withNoTTY(async () => {
      await expect(selectChain()).rejects.toThrow("No TTY detected. Provide --chain-id");
    });
  });
});
