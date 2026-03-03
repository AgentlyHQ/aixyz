import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  generateLocalWallet,
  hasLocalWallet,
  readLocalWallet,
  getLocalWalletPrivateKey,
  getLocalWalletPath,
} from "./local";

const testDir = join(tmpdir(), "aixyz-cli-local-wallet-test");

beforeAll(() => {
  mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("generateLocalWallet", () => {
  test("creates .aixyz/wallet.json with mnemonic and address", () => {
    const wallet = generateLocalWallet(testDir);
    expect(wallet.mnemonic).toBeTruthy();
    expect(wallet.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    const walletPath = getLocalWalletPath(testDir);
    expect(existsSync(walletPath)).toBe(true);
    const content = JSON.parse(readFileSync(walletPath, "utf-8"));
    expect(content.mnemonic).toBe(wallet.mnemonic);
    expect(content.address).toBe(wallet.address);
  });

  test("creates .aixyz/.gitignore ignoring everything", () => {
    const gitignorePath = join(testDir, ".aixyz", ".gitignore");
    expect(existsSync(gitignorePath)).toBe(true);
    expect(readFileSync(gitignorePath, "utf-8").trim()).toBe("*");
  });

  test("creates .aixyz/.aiignore ignoring everything", () => {
    const aiignorePath = join(testDir, ".aixyz", ".aiignore");
    expect(existsSync(aiignorePath)).toBe(true);
    expect(readFileSync(aiignorePath, "utf-8").trim()).toBe("*");
  });

  test("mnemonic is 12 words", () => {
    const wallet = generateLocalWallet(testDir);
    expect(wallet.mnemonic.split(" ")).toHaveLength(12);
  });
});

describe("hasLocalWallet", () => {
  test("returns true when wallet exists", () => {
    generateLocalWallet(testDir);
    expect(hasLocalWallet(testDir)).toBe(true);
  });

  test("returns false when wallet does not exist", () => {
    const emptyDir = join(tmpdir(), "aixyz-cli-no-wallet-test");
    mkdirSync(emptyDir, { recursive: true });
    try {
      expect(hasLocalWallet(emptyDir)).toBe(false);
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});

describe("readLocalWallet", () => {
  test("reads wallet from .aixyz/wallet.json", () => {
    const wallet = generateLocalWallet(testDir);
    const read = readLocalWallet(testDir);
    expect(read.mnemonic).toBe(wallet.mnemonic);
    expect(read.address).toBe(wallet.address);
  });

  test("throws when wallet does not exist", () => {
    const emptyDir = join(tmpdir(), "aixyz-cli-no-wallet-read-test");
    mkdirSync(emptyDir, { recursive: true });
    try {
      expect(() => readLocalWallet(emptyDir)).toThrow("aixyz wallet generate");
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});

describe("getLocalWalletPrivateKey", () => {
  test("returns a valid private key hex string", () => {
    generateLocalWallet(testDir);
    const key = getLocalWalletPrivateKey(testDir);
    expect(key).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  test("returns deterministic private key for same mnemonic", () => {
    generateLocalWallet(testDir);
    const key1 = getLocalWalletPrivateKey(testDir);
    const key2 = getLocalWalletPrivateKey(testDir);
    expect(key1).toBe(key2);
  });
});
