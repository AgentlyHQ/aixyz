import { describe, expect, test, mock, afterAll } from "bun:test";
import { sepolia } from "viem/chains";

// Static imports are hoisted before mock.module calls, capturing the original implementations.
// These are used in afterAll to restore the modules and prevent mock pollution across test files.
import { createWalletFromMethod as _createWalletFromMethod } from "./walletFactory";
import {
  signWithBrowser as _signWithBrowser,
  escapeHtml as _escapeHtml,
  safeJsonEmbed as _safeJsonEmbed,
  buildHtml as _buildHtml,
} from "./browser";

const FAKE_TX_HASH = "0x" + "ab".repeat(32);
const FAKE_RAW = "0x02deadbeef" as `0x${string}`;
const FAKE_ADDRESS = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf" as `0x${string}`;

mock.module("./browser.js", () => ({
  signWithBrowser: () => Promise.resolve({ txHash: FAKE_TX_HASH }),
}));

// Mock walletFactory.js (not index.js) so that index.test.ts is unaffected.
// sign.ts imports createWalletFromMethod from ./walletFactory, which re-exports from ./index.
mock.module("./walletFactory.js", () => ({
  createWalletFromMethod: () =>
    Promise.resolve({
      account: { address: FAKE_ADDRESS },
      prepareTransactionRequest: () => Promise.resolve({ to: "0x1234", data: "0x" }),
      signTransaction: () => Promise.resolve(FAKE_RAW),
    }),
}));

const { signTransaction } = await import("./sign.js");

// Restore original modules after tests to prevent mock pollution across test files.
// mock.module() persists across test files in the same bun test process.
afterAll(() => {
  mock.module("./browser.js", () => ({
    signWithBrowser: _signWithBrowser,
    escapeHtml: _escapeHtml,
    safeJsonEmbed: _safeJsonEmbed,
    buildHtml: _buildHtml,
  }));
  mock.module("./walletFactory.js", () => ({
    createWalletFromMethod: _createWalletFromMethod,
  }));
});

const baseTx = {
  to: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
  data: "0xdeadbeef" as `0x${string}`,
};

describe("signTransaction", () => {
  test("browser method routes to signViaBrowser and returns sent result", async () => {
    const result = await signTransaction({
      walletMethod: { type: "browser" },
      tx: baseTx,
      chain: sepolia,
      options: { browser: { chainId: 11155111, chainName: "sepolia" } },
    });
    expect(result.kind).toBe("sent");
    if (result.kind === "sent") {
      expect(result.txHash).toBe(FAKE_TX_HASH);
    }
  });

  test("browser method throws without browser options", async () => {
    await expect(
      signTransaction({
        walletMethod: { type: "browser" },
        tx: baseTx,
        chain: sepolia,
      }),
    ).rejects.toThrow("Browser wallet requires chainId and chainName parameters");
  });

  test("privatekey method routes to wallet client and returns signed result", async () => {
    const result = await signTransaction({
      walletMethod: { type: "privatekey", resolveKey: () => Promise.resolve("0x01") },
      tx: baseTx,
      chain: sepolia,
    });
    expect(result.kind).toBe("signed");
    if (result.kind === "signed") {
      expect(result.raw).toBe(FAKE_RAW);
      expect(result.address).toBe(FAKE_ADDRESS);
    }
  });

  test("keystore method routes to wallet client and returns signed result", async () => {
    const result = await signTransaction({
      walletMethod: { type: "keystore", path: "/fake/keystore.json" },
      tx: baseTx,
      chain: sepolia,
    });
    expect(result.kind).toBe("signed");
    if (result.kind === "signed") {
      expect(result.raw).toBe(FAKE_RAW);
      expect(result.address).toBe(FAKE_ADDRESS);
    }
  });
});
