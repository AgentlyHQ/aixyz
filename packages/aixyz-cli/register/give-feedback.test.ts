import { describe, expect, test } from "bun:test";
import { CHAIN_ID, getReputationRegistryAddress } from "@aixyz/erc-8004";
import { giveFeedback } from "./give-feedback";
import { validateFeedbackValue, validateValueDecimals, validateBytes32Hash } from "./utils/validate";

describe("give-feedback validators", () => {
  describe("validateFeedbackValue", () => {
    test("accepts 0", () => {
      expect(() => validateFeedbackValue("0")).not.toThrow();
    });

    test("accepts positive integer", () => {
      expect(() => validateFeedbackValue("100")).not.toThrow();
    });

    test("accepts negative integer", () => {
      expect(() => validateFeedbackValue("-50")).not.toThrow();
    });

    test("accepts large integer", () => {
      expect(() => validateFeedbackValue("999999999")).not.toThrow();
    });

    test("rejects empty string", () => {
      expect(() => validateFeedbackValue("")).toThrow("Invalid feedback value");
    });

    test("rejects whitespace-only string", () => {
      expect(() => validateFeedbackValue("  ")).toThrow("Invalid feedback value");
    });

    test("rejects float", () => {
      expect(() => validateFeedbackValue("1.5")).toThrow("Invalid feedback value");
    });

    test("rejects non-numeric string", () => {
      expect(() => validateFeedbackValue("abc")).toThrow("Invalid feedback value");
    });

    test("rejects Infinity", () => {
      expect(() => validateFeedbackValue("Infinity")).toThrow("Invalid feedback value");
    });

    test("rejects NaN", () => {
      expect(() => validateFeedbackValue("NaN")).toThrow("Invalid feedback value");
    });

    test("accepts 1e38", () => {
      expect(() => validateFeedbackValue("100000000000000000000000000000000000000")).not.toThrow();
    });

    test("accepts -1e38", () => {
      expect(() => validateFeedbackValue("-100000000000000000000000000000000000000")).not.toThrow();
    });

    test("rejects value exceeding 1e38", () => {
      expect(() => validateFeedbackValue("100000000000000000000000000000000000001")).toThrow(
        "Must be between -1e38 and 1e38",
      );
    });

    test("rejects value below -1e38", () => {
      expect(() => validateFeedbackValue("-100000000000000000000000000000000000001")).toThrow(
        "Must be between -1e38 and 1e38",
      );
    });
  });

  describe("validateValueDecimals", () => {
    test("accepts 0", () => {
      expect(() => validateValueDecimals("0")).not.toThrow();
    });

    test("accepts 18", () => {
      expect(() => validateValueDecimals("18")).not.toThrow();
    });

    test("rejects 19", () => {
      expect(() => validateValueDecimals("19")).toThrow("Invalid value decimals");
    });

    test("rejects negative", () => {
      expect(() => validateValueDecimals("-1")).toThrow("Invalid value decimals");
    });

    test("rejects float", () => {
      expect(() => validateValueDecimals("1.5")).toThrow("Invalid value decimals");
    });

    test("rejects empty string", () => {
      expect(() => validateValueDecimals("")).toThrow("Invalid value decimals");
    });
  });

  describe("validateBytes32Hash", () => {
    test("accepts valid bytes32 hash", () => {
      expect(() =>
        validateBytes32Hash("0x0000000000000000000000000000000000000000000000000000000000000001", "feedback hash"),
      ).not.toThrow();
    });

    test("accepts all zeros", () => {
      expect(() =>
        validateBytes32Hash("0x0000000000000000000000000000000000000000000000000000000000000000", "feedback hash"),
      ).not.toThrow();
    });

    test("rejects too short", () => {
      expect(() => validateBytes32Hash("0x00", "feedback hash")).toThrow("Invalid feedback hash");
    });

    test("rejects missing 0x prefix", () => {
      expect(() =>
        validateBytes32Hash("0000000000000000000000000000000000000000000000000000000000000001", "feedback hash"),
      ).toThrow("Invalid feedback hash");
    });

    test("rejects non-hex characters", () => {
      expect(() =>
        validateBytes32Hash("0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG", "feedback hash"),
      ).toThrow("Invalid feedback hash");
    });
  });
});

describe("give-feedback reputation registry", () => {
  test("reputation registry address is returned for sepolia", () => {
    const address = getReputationRegistryAddress(CHAIN_ID.SEPOLIA);
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  test("reputation registry address is returned for base-sepolia", () => {
    const address = getReputationRegistryAddress(CHAIN_ID.BASE_SEPOLIA);
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });
});

describe("give-feedback command validation", () => {
  test("localhost requires --registry flag", async () => {
    await expect(giveFeedback({ agentId: "1", value: "100", valueDecimals: "0", chain: "localhost" })).rejects.toThrow(
      "--registry is required for localhost",
    );
  });

  test("rejects unsupported chain", async () => {
    await expect(giveFeedback({ agentId: "1", value: "100", valueDecimals: "0", chain: "fakenet" })).rejects.toThrow(
      "Unsupported chain: fakenet",
    );
  });

  test("rejects invalid registry address", async () => {
    await expect(
      giveFeedback({
        agentId: "1",
        value: "100",
        valueDecimals: "0",
        chain: "localhost",
        registry: "not-an-address",
      }),
    ).rejects.toThrow("Invalid registry address: not-an-address");
  });

  test("rejects --browser with --rpc-url", async () => {
    await expect(
      giveFeedback({
        agentId: "1",
        value: "100",
        valueDecimals: "0",
        chain: "sepolia",
        browser: true,
        rpcUrl: "http://localhost:8545",
      }),
    ).rejects.toThrow("--rpc-url cannot be used with browser wallet");
  });

  test("dry-run completes without wallet interaction when --broadcast is not set", async () => {
    await expect(
      giveFeedback({ agentId: "1", value: "100", valueDecimals: "0", chain: "sepolia" }),
    ).resolves.toBeUndefined();
  });

  test("rejects invalid agent ID", async () => {
    await expect(giveFeedback({ agentId: "-1", value: "100", chain: "sepolia" })).rejects.toThrow("Invalid agent ID");
  });

  test("rejects invalid feedback value", async () => {
    await expect(giveFeedback({ agentId: "1", value: "abc", chain: "sepolia" })).rejects.toThrow(
      "Invalid feedback value",
    );
  });

  test("rejects invalid value decimals", async () => {
    await expect(giveFeedback({ agentId: "1", value: "100", valueDecimals: "256", chain: "sepolia" })).rejects.toThrow(
      "Invalid value decimals",
    );
  });

  test("dry-run with all optional fields", async () => {
    await expect(
      giveFeedback({
        agentId: "1",
        value: "-50",
        valueDecimals: "18",
        tag1: "quality",
        tag2: "speed",
        endpoint: "/api/chat",
        feedbackUri: "https://example.com/feedback.json",
        feedbackHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
        chain: "sepolia",
      }),
    ).resolves.toBeUndefined();
  });
});
