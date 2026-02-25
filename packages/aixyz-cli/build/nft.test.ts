import { describe, test, expect, afterAll, beforeAll } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";
import { traceFileSystemAssets, copyTracedFiles, copyAppAssets } from "./nft";

const TMP = resolve(import.meta.dir, "__nft_test__");
const APP = resolve(TMP, "app");
const OUT = resolve(TMP, "out");

beforeAll(() => {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(resolve(APP, "tools"), { recursive: true });
  mkdirSync(resolve(APP, "prompts"), { recursive: true });
  mkdirSync(resolve(APP, "data"), { recursive: true });
  mkdirSync(OUT, { recursive: true });
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// traceFileSystemAssets
// ---------------------------------------------------------------------------

describe("traceFileSystemAssets", () => {
  test("detects readFileSync with a literal path", async () => {
    writeFileSync(resolve(APP, "prompts/system.txt"), "You are helpful.");
    // Path is CWD-relative (TMP), matching what a deployed server would use.
    writeFileSync(
      resolve(APP, "agent.ts"),
      `import { readFileSync } from "node:fs";\nconst p = readFileSync("./app/prompts/system.txt", "utf-8");\n`,
    );

    const found = await traceFileSystemAssets(APP, TMP);
    const names = found.map((f) => f.split("/").pop());
    expect(names).toContain("system.txt");
  });

  test("detects Bun.file() with a literal path", async () => {
    writeFileSync(resolve(APP, "data/embeddings.bin"), "BINARY");
    writeFileSync(
      resolve(APP, "tools/search.ts"),
      `const raw = await Bun.file("./app/data/embeddings.bin").arrayBuffer();\n`,
    );

    const found = await traceFileSystemAssets(APP, TMP);
    const names = found.map((f) => f.split("/").pop());
    expect(names).toContain("embeddings.bin");
  });

  test("does not return TypeScript source files", async () => {
    writeFileSync(
      resolve(APP, "tools/utils.ts"),
      `import { readFileSync } from "fs";\nconst src = readFileSync("./app/tools/utils.ts");\n`,
    );

    const found = await traceFileSystemAssets(APP, TMP);
    const tsFiles = found.filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
    expect(tsFiles).toHaveLength(0);
  });

  test("ignores template literals and variable paths", async () => {
    writeFileSync(
      resolve(APP, "tools/dynamic.ts"),
      "const f = readFileSync(`./app/data/${name}.json`);\nconst g = readFileSync(somePath);\n",
    );

    // Should not throw and should not add non-existent dynamic paths
    const found = await traceFileSystemAssets(APP, TMP);
    // The template-literal path should not appear because it contains ${
    const hasDynamic = found.some((f) => f.includes("${"));
    expect(hasDynamic).toBe(false);
  });

  test("ignores absolute paths outside the project", async () => {
    writeFileSync(
      resolve(APP, "tools/abs.ts"),
      'import { readFileSync } from "fs";\nconst cert = readFileSync("/etc/ssl/certs/ca-certificates.crt");\n',
    );

    const found = await traceFileSystemAssets(APP, TMP);
    const absPaths = found.filter((f) => f.startsWith("/etc"));
    expect(absPaths).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// copyTracedFiles
// ---------------------------------------------------------------------------

describe("copyTracedFiles", () => {
  test("copies a traced file into the output directory", async () => {
    const dataFile = resolve(TMP, "app/data/config.json");
    writeFileSync(dataFile, '{"ok":true}');

    await copyTracedFiles([dataFile], TMP, OUT);

    const dest = resolve(OUT, "app/data/config.json");
    expect(await Bun.file(dest).text()).toBe('{"ok":true}');
  });

  test("skips files outside the project root", async () => {
    const outside = "/tmp/outside_nft_test.txt";
    writeFileSync(outside, "secret");
    await copyTracedFiles([outside], TMP, OUT);
    // Should not have been copied into OUT
    expect(existsSync(resolve(OUT, "outside_nft_test.txt"))).toBe(false);
  });

  test("is a no-op for an empty list", async () => {
    await copyTracedFiles([], TMP, OUT); // should not throw
  });
});

// ---------------------------------------------------------------------------
// copyAppAssets
// ---------------------------------------------------------------------------

describe("copyAppAssets", () => {
  test("copies non-code files that match outputFileTracingIncludes", async () => {
    writeFileSync(resolve(APP, "prompts/welcome.txt"), "Hello!");
    await copyAppAssets(APP, OUT, ["**/*.txt"], []);

    const dest = resolve(OUT, "app/prompts/welcome.txt");
    expect(await Bun.file(dest).text()).toBe("Hello!");
  });

  test("does not copy files excluded by outputFileTracingExcludes", async () => {
    writeFileSync(resolve(APP, "prompts/secret.txt"), "TOP SECRET");
    await copyAppAssets(APP, OUT, ["**/*.txt"], ["**/secret.*"]);

    expect(existsSync(resolve(OUT, "app/prompts/secret.txt"))).toBe(false);
  });

  test("does not copy TypeScript source files even when included by pattern", async () => {
    writeFileSync(resolve(APP, "agent.ts"), "export default {};");
    await copyAppAssets(APP, OUT, ["**/*"], []);

    expect(existsSync(resolve(OUT, "app/agent.ts"))).toBe(false);
  });

  test("does not copy icon files handled by the icons pipeline", async () => {
    writeFileSync(resolve(APP, "icon.png"), "PNG_DATA");
    await copyAppAssets(APP, OUT, ["**/*"], []);

    expect(existsSync(resolve(OUT, "app/icon.png"))).toBe(false);
  });

  test("is a no-op when outputFileTracingIncludes is empty (default)", async () => {
    writeFileSync(resolve(APP, "data/corpus.json"), "{}");
    await copyAppAssets(APP, OUT, [], []);

    expect(existsSync(resolve(OUT, "app/data/corpus.json"))).toBe(false);
  });
});
