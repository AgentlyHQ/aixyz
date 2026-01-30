import { describe, expect, test, mock, beforeAll, afterAll } from "bun:test";
import { encryptKeystoreJsonSync } from "ethers";
import { sepolia } from "viem/chains";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_PRIVATE_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";
const TEST_ADDRESS = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf";
const TEST_PASSWORD = "testpassword";

const testDir = join(tmpdir(), "agently-cli-keystore-test");
const testKeystorePath = join(testDir, "test-keystore.json");

// Mock the password prompt to return TEST_PASSWORD
mock.module("@inquirer/prompts", () => ({
  password: () => Promise.resolve(TEST_PASSWORD),
}));

// Import after mocking
const { decryptKeystore, createKeystoreWallet } = await import("./keystore.js");

beforeAll(() => {
  const json = encryptKeystoreJsonSync({ address: TEST_ADDRESS, privateKey: TEST_PRIVATE_KEY }, TEST_PASSWORD, {
    scrypt: { N: 2, r: 1, p: 1 },
  });
  mkdirSync(testDir, { recursive: true });
  writeFileSync(testKeystorePath, json);
});

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("decryptKeystore", () => {
  test("returns private key from keystore file", async () => {
    const key = await decryptKeystore(testKeystorePath);
    expect(key).toBe(TEST_PRIVATE_KEY);
  });

  test("throws for missing file", async () => {
    await expect(decryptKeystore("/nonexistent/keystore.json")).rejects.toThrow("Keystore file not found");
  });

  test("throws for invalid keystore JSON", async () => {
    const invalidPath = join(testDir, "invalid-keystore.json");
    writeFileSync(invalidPath, JSON.stringify({ not: "a keystore" }));
    await expect(decryptKeystore(invalidPath)).rejects.toThrow("Invalid keystore file");
  });
});

describe("createKeystoreWallet", () => {
  test("creates wallet with correct account", async () => {
    const wallet = await createKeystoreWallet(testKeystorePath, sepolia);
    expect(wallet.account).toBeDefined();
    expect(wallet.account?.address).toBe(TEST_ADDRESS);
  });

  test("creates wallet with chain configured", async () => {
    const wallet = await createKeystoreWallet(testKeystorePath, sepolia);
    expect(wallet.chain).toStrictEqual(sepolia);
  });
});
