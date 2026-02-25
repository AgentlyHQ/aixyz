import { describe, expect, test } from "bun:test";
import { appendResponse } from "./append-response";
import { validateClientAddress, validateFeedbackIndex, validateBytes32Hash } from "./utils/validate";

describe("append-response validators", () => {
  describe("validateClientAddress", () => {
    test("accepts valid address", () => {
      expect(() => validateClientAddress("0x0000000000000000000000000000000000000001")).not.toThrow();
    });

    test("accepts checksummed address", () => {
      expect(() => validateClientAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")).not.toThrow();
    });

    test("rejects invalid address", () => {
      expect(() => validateClientAddress("not-an-address")).toThrow("Invalid client address");
    });

    test("rejects empty string", () => {
      expect(() => validateClientAddress("")).toThrow("Invalid client address");
    });

    test("rejects short hex", () => {
      expect(() => validateClientAddress("0x1234")).toThrow("Invalid client address");
    });
  });

  describe("validateBytes32Hash (response hash)", () => {
    test("accepts valid bytes32 hash", () => {
      expect(() =>
        validateBytes32Hash("0x0000000000000000000000000000000000000000000000000000000000000001", "response hash"),
      ).not.toThrow();
    });

    test("rejects too short", () => {
      expect(() => validateBytes32Hash("0x00", "response hash")).toThrow("Invalid response hash");
    });

    test("rejects missing 0x prefix", () => {
      expect(() =>
        validateBytes32Hash("0000000000000000000000000000000000000000000000000000000000000001", "response hash"),
      ).toThrow("Invalid response hash");
    });
  });
});

describe("append-response command validation", () => {
  test("localhost requires --registry flag", async () => {
    await expect(
      appendResponse({
        agentId: "1",
        clientAddress: "0x0000000000000000000000000000000000000001",
        feedbackIndex: "1",
        responseUri: "https://example.com/response.json",
        chain: "localhost",
      }),
    ).rejects.toThrow("--registry is required for localhost");
  });

  test("rejects unsupported chain", async () => {
    await expect(
      appendResponse({
        agentId: "1",
        clientAddress: "0x0000000000000000000000000000000000000001",
        feedbackIndex: "1",
        responseUri: "https://example.com/response.json",
        chain: "fakenet",
      }),
    ).rejects.toThrow("Unsupported chain: fakenet");
  });

  test("rejects invalid registry address", async () => {
    await expect(
      appendResponse({
        agentId: "1",
        clientAddress: "0x0000000000000000000000000000000000000001",
        feedbackIndex: "1",
        responseUri: "https://example.com/response.json",
        chain: "localhost",
        registry: "not-an-address",
      }),
    ).rejects.toThrow("Invalid registry address: not-an-address");
  });

  test("rejects --browser with --rpc-url", async () => {
    await expect(
      appendResponse({
        agentId: "1",
        clientAddress: "0x0000000000000000000000000000000000000001",
        feedbackIndex: "1",
        responseUri: "https://example.com/response.json",
        chain: "sepolia",
        browser: true,
        rpcUrl: "http://localhost:8545",
      }),
    ).rejects.toThrow("--rpc-url cannot be used with browser wallet");
  });

  test("dry-run completes without wallet interaction when --broadcast is not set", async () => {
    await expect(
      appendResponse({
        agentId: "1",
        clientAddress: "0x0000000000000000000000000000000000000001",
        feedbackIndex: "1",
        responseUri: "https://example.com/response.json",
        chain: "sepolia",
      }),
    ).resolves.toBeUndefined();
  });

  test("rejects invalid agent ID", async () => {
    await expect(
      appendResponse({
        agentId: "-1",
        clientAddress: "0x0000000000000000000000000000000000000001",
        feedbackIndex: "1",
        chain: "sepolia",
      }),
    ).rejects.toThrow("Invalid agent ID");
  });

  test("rejects invalid client address", async () => {
    await expect(
      appendResponse({
        agentId: "1",
        clientAddress: "not-an-address",
        feedbackIndex: "1",
        chain: "sepolia",
      }),
    ).rejects.toThrow("Invalid client address");
  });

  test("rejects invalid feedback index", async () => {
    await expect(
      appendResponse({
        agentId: "1",
        clientAddress: "0x0000000000000000000000000000000000000001",
        feedbackIndex: "-1",
        chain: "sepolia",
      }),
    ).rejects.toThrow("Invalid feedback index");
  });

  test("dry-run with response URI and hash", async () => {
    await expect(
      appendResponse({
        agentId: "1",
        clientAddress: "0x0000000000000000000000000000000000000001",
        feedbackIndex: "1",
        responseUri: "https://example.com/response.json",
        responseHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
        chain: "sepolia",
      }),
    ).resolves.toBeUndefined();
  });
});
