import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { sepolia } from "viem/chains";
import { selectWalletMethod, createWalletFromMethod, type WalletOptions } from "./index";

// Valid test private key (do not use in production!)
const TEST_PRIVATE_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";

describe("selectWalletMethod", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.PRIVATE_KEY;
    delete process.env.PRIVATE_KEY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.PRIVATE_KEY = originalEnv;
    } else {
      delete process.env.PRIVATE_KEY;
    }
  });

  test("returns keystore method when keystore option provided", async () => {
    const options: WalletOptions = { keystore: "/path/to/keystore" };
    const result = await selectWalletMethod(options);
    expect(result).toEqual({ type: "keystore", path: "/path/to/keystore" });
  });

  test("returns browser method when browser option provided", async () => {
    const options: WalletOptions = { browser: true };
    const result = await selectWalletMethod(options);
    expect(result).toEqual({ type: "browser" });
  });

  test("returns privatekey method when PRIVATE_KEY env var set", async () => {
    process.env.PRIVATE_KEY = TEST_PRIVATE_KEY;
    const options: WalletOptions = {};
    const result = await selectWalletMethod(options);
    expect(result.type).toBe("privatekey");
    expect(result.type === "privatekey" && (await result.resolveKey())).toBe(TEST_PRIVATE_KEY);
    expect(process.env.PRIVATE_KEY).toBeUndefined();
  });

  test("keystore option takes precedence over env var", async () => {
    process.env.PRIVATE_KEY = TEST_PRIVATE_KEY;
    const options: WalletOptions = { keystore: "/path/to/keystore" };
    const result = await selectWalletMethod(options);
    expect(result).toEqual({ type: "keystore", path: "/path/to/keystore" });
  });

  test("browser option takes precedence over env var", async () => {
    process.env.PRIVATE_KEY = TEST_PRIVATE_KEY;
    const options: WalletOptions = { browser: true };
    const result = await selectWalletMethod(options);
    expect(result).toEqual({ type: "browser" });
  });
});

describe("createWalletFromMethod", () => {
  test("creates wallet for privatekey method", async () => {
    const method = { type: "privatekey" as const, resolveKey: () => Promise.resolve(TEST_PRIVATE_KEY) };
    const wallet = await createWalletFromMethod(method, sepolia);
    expect(wallet).toBeDefined();
    expect(wallet.account).toBeDefined();
    expect(wallet.account?.address).toStrictEqual("0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf");
  });

  test("throws for missing keystore file", async () => {
    const method = { type: "keystore" as const, path: "/path/to/keystore" };
    await expect(createWalletFromMethod(method, sepolia)).rejects.toThrow("Keystore file not found");
  });

  test("throws for browser method (should use registerWithBrowser)", async () => {
    const method = { type: "browser" as const };
    await expect(createWalletFromMethod(method, sepolia)).rejects.toThrow(
      "Browser wallets should use registerWithBrowser",
    );
  });
});
