import { describe, expect, test, afterAll, beforeAll } from "bun:test";
import { rmSync } from "fs";
import { mkdir } from "node:fs/promises";
import { resolveUri } from "./utils";
import { join } from "path";

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
      expect(() => resolveUri(dirWithJsonSuffix)).toThrow(Error);
      expect(() => resolveUri(dirWithJsonSuffix)).toThrow("Not a file");
    } finally {
      rmSync(dirWithJsonSuffix, { recursive: true, force: true });
    }
  });

  test("throws for non-existent .json file", () => {
    expect(() => resolveUri("./non-existent.json")).toThrow(Error);
    expect(() => resolveUri("./non-existent.json")).toThrow("File not found");
  });

  test("throws for invalid JSON content", async () => {
    await Bun.write(testJsonPath, "not valid json {{{");

    try {
      expect(() => resolveUri(testJsonPath)).toThrow(Error);
      expect(() => resolveUri(testJsonPath)).toThrow("Invalid JSON");
    } finally {
      await Bun.file(testJsonPath).unlink();
    }
  });
});
