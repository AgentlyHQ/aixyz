import { describe, expect, test, afterAll, beforeAll } from "bun:test";
import { rmSync } from "fs";
import { mkdir } from "node:fs/promises";
import { validatePrivateKey, CliError, resolveUri } from "./utils.js";
import { join } from "path";

describe("validatePrivateKey", () => {
  test("accepts valid 64-char hex key with 0x prefix", () => {
    const key = "0x0000000000000000000000000000000000000000000000000000000000000001";
    const result = validatePrivateKey(key);
    expect(result).toStrictEqual(key);
  });

  test("accepts valid 64-char hex key without 0x prefix", () => {
    const key = "0000000000000000000000000000000000000000000000000000000000000001";
    const result = validatePrivateKey(key);
    expect(result).toStrictEqual(`0x${key}`);
  });

  test("accepts mixed case hex characters", () => {
    const key = "0xaAbBcCdDeEfF0000000000000000000000000000000000000000000000000001";
    const result = validatePrivateKey(key);
    expect(result).toStrictEqual(key);
  });

  test("rejects key that is too short", () => {
    const key = "0x1234";
    expect(() => validatePrivateKey(key)).toThrow(CliError);
    expect(() => validatePrivateKey(key)).toThrow("Invalid private key format");
  });

  test("rejects key that is too long", () => {
    const key = "0x00000000000000000000000000000000000000000000000000000000000000001";
    expect(() => validatePrivateKey(key)).toThrow(CliError);
  });

  test("rejects key with invalid characters", () => {
    const key = "0xGGGG000000000000000000000000000000000000000000000000000000000001";
    expect(() => validatePrivateKey(key)).toThrow(CliError);
  });

  test("rejects empty string", () => {
    expect(() => validatePrivateKey("")).toThrow(CliError);
  });

  test("rejects random string", () => {
    expect(() => validatePrivateKey("not-a-key")).toThrow(CliError);
  });
});

describe("CliError", () => {
  test("is an instance of Error", () => {
    const error = new CliError("test message");
    expect(error).toBeInstanceOf(Error);
  });

  test("has correct name property", () => {
    const error = new CliError("test message");
    expect(error.name).toStrictEqual("CliError");
  });

  test("has correct message property", () => {
    const error = new CliError("test message");
    expect(error.message).toStrictEqual("test message");
  });

  test("can be caught as Error", () => {
    let caught = false;
    try {
      throw new CliError("test");
    } catch (e) {
      if (e instanceof Error) {
        caught = true;
      }
    }
    expect(caught).toStrictEqual(true);
  });
});

describe("resolveUri", () => {
  const testDir = join(import.meta.dir, "__test_fixtures__");
  const testJsonPath = join(testDir, "test-metadata.json");
  const testMetadata = { name: "Test Agent", description: "A test agent" };

  beforeAll(() => {
    // ensure test directory exists
    mkdir(testDir, { recursive: true });
  });

  afterAll(() => {
    // clean up test directory
    rmSync(testDir, { recursive: true, force: true });
  });

  test("returns ipfs:// URIs unchanged", () => {
    const uri = "ipfs://QmTest123";
    expect(resolveUri(uri)).toStrictEqual(uri);
  });

  test("returns https:// URIs unchanged", () => {
    const uri = "https://example.com/metadata.json";
    expect(resolveUri(uri)).toStrictEqual(uri);
  });

  test("returns http:// URIs unchanged", () => {
    const uri = "http://example.com/metadata.json";
    expect(resolveUri(uri)).toStrictEqual(uri);
  });

  test("converts .json file to base64 data URI", async () => {
    await Bun.write(testJsonPath, JSON.stringify(testMetadata));

    try {
      const result = resolveUri(testJsonPath);
      expect(result.startsWith("data:application/json;base64,")).toStrictEqual(true);

      // Decode and verify content
      const base64 = result.replace("data:application/json;base64,", "");
      const decoded = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
      expect(decoded).toStrictEqual(testMetadata);
    } finally {
      await Bun.file(testJsonPath).unlink();
    }
  });

  test("throws for directory path", async () => {
    await mkdir(testDir, { recursive: true });
    const dirWithJsonSuffix = join(testDir, "not-a-file.json");
    await mkdir(dirWithJsonSuffix, { recursive: true });

    try {
      expect(() => resolveUri(dirWithJsonSuffix)).toThrow(CliError);
      expect(() => resolveUri(dirWithJsonSuffix)).toThrow("Not a file");
    } finally {
      rmSync(dirWithJsonSuffix, { recursive: true, force: true });
    }
  });

  test("throws for non-existent .json file", () => {
    expect(() => resolveUri("./non-existent.json")).toThrow(CliError);
    expect(() => resolveUri("./non-existent.json")).toThrow("File not found");
  });

  test("throws for invalid JSON content", async () => {
    await Bun.write(testJsonPath, "not valid json {{{");

    try {
      expect(() => resolveUri(testJsonPath)).toThrow(CliError);
      expect(() => resolveUri(testJsonPath)).toThrow("Invalid JSON");
    } finally {
      await Bun.file(testJsonPath).unlink();
    }
  });
});
