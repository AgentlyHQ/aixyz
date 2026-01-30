import { describe, expect, test } from "bun:test";
import { sepolia } from "viem/chains";
import { createPrivateKeyWallet } from "./privatekey.js";

// Valid test private key (do not use in production!)
const TEST_PRIVATE_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";

describe("createPrivateKeyWallet", () => {
  test("creates wallet with correct address", () => {
    const wallet = createPrivateKeyWallet(TEST_PRIVATE_KEY, sepolia);
    expect(wallet.account).toBeDefined();
    // Private key 1 corresponds to this address
    expect(wallet.account?.address).toStrictEqual("0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf");
  });

  test("creates wallet with chain configured", () => {
    const wallet = createPrivateKeyWallet(TEST_PRIVATE_KEY, sepolia);
    expect(wallet.chain).toStrictEqual(sepolia);
  });

  test("throws for invalid private key", () => {
    expect(() => createPrivateKeyWallet("invalid", sepolia)).toThrow("Invalid private key format");
  });

  test("accepts key without 0x prefix", () => {
    const keyWithoutPrefix = "0000000000000000000000000000000000000000000000000000000000000001";
    const wallet = createPrivateKeyWallet(keyWithoutPrefix, sepolia);
    expect(wallet.account?.address).toStrictEqual("0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf");
  });
});
