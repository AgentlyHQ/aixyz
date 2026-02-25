import { describe, expect, test } from "bun:test";
import { revokeFeedback } from "./revoke-feedback";
import { validateAgentId, validateFeedbackIndex } from "./utils/validate";

describe("revoke-feedback validators", () => {
  describe("validateFeedbackIndex", () => {
    test("rejects 0", () => {
      expect(() => validateFeedbackIndex("0")).toThrow("Invalid feedback index");
    });

    test("accepts 1", () => {
      expect(() => validateFeedbackIndex("1")).not.toThrow();
    });

    test("accepts positive integer", () => {
      expect(() => validateFeedbackIndex("42")).not.toThrow();
    });

    test("accepts large integer", () => {
      expect(() => validateFeedbackIndex("999999999")).not.toThrow();
    });

    test("rejects empty string", () => {
      expect(() => validateFeedbackIndex("")).toThrow("Invalid feedback index");
    });

    test("rejects whitespace-only string", () => {
      expect(() => validateFeedbackIndex("  ")).toThrow("Invalid feedback index");
    });

    test("rejects negative number", () => {
      expect(() => validateFeedbackIndex("-1")).toThrow("Invalid feedback index");
    });

    test("rejects float", () => {
      expect(() => validateFeedbackIndex("1.5")).toThrow("Invalid feedback index");
    });

    test("rejects non-numeric string", () => {
      expect(() => validateFeedbackIndex("abc")).toThrow("Invalid feedback index");
    });

    test("rejects Infinity", () => {
      expect(() => validateFeedbackIndex("Infinity")).toThrow("Invalid feedback index");
    });

    test("rejects NaN", () => {
      expect(() => validateFeedbackIndex("NaN")).toThrow("Invalid feedback index");
    });
  });
});

describe("revoke-feedback command validation", () => {
  test("localhost requires --registry flag", async () => {
    await expect(revokeFeedback({ agentId: "1", feedbackIndex: "1", chain: "localhost" })).rejects.toThrow(
      "--registry is required for localhost",
    );
  });

  test("rejects unsupported chain", async () => {
    await expect(revokeFeedback({ agentId: "1", feedbackIndex: "1", chain: "fakenet" })).rejects.toThrow(
      "Unsupported chain: fakenet",
    );
  });

  test("rejects invalid registry address", async () => {
    await expect(
      revokeFeedback({
        agentId: "1",
        feedbackIndex: "1",
        chain: "localhost",
        registry: "not-an-address",
      }),
    ).rejects.toThrow("Invalid registry address: not-an-address");
  });

  test("rejects --browser with --rpc-url", async () => {
    await expect(
      revokeFeedback({
        agentId: "1",
        feedbackIndex: "1",
        chain: "sepolia",
        browser: true,
        rpcUrl: "http://localhost:8545",
      }),
    ).rejects.toThrow("--rpc-url cannot be used with browser wallet");
  });

  test("dry-run completes without wallet interaction when --broadcast is not set", async () => {
    await expect(revokeFeedback({ agentId: "1", feedbackIndex: "1", chain: "sepolia" })).resolves.toBeUndefined();
  });

  test("rejects invalid agent ID", async () => {
    await expect(revokeFeedback({ agentId: "-1", feedbackIndex: "1", chain: "sepolia" })).rejects.toThrow(
      "Invalid agent ID",
    );
  });

  test("rejects invalid feedback index", async () => {
    await expect(revokeFeedback({ agentId: "1", feedbackIndex: "-1", chain: "sepolia" })).rejects.toThrow(
      "Invalid feedback index",
    );
  });

  test("rejects non-numeric feedback index", async () => {
    await expect(revokeFeedback({ agentId: "1", feedbackIndex: "abc", chain: "sepolia" })).rejects.toThrow(
      "Invalid feedback index",
    );
  });
});
