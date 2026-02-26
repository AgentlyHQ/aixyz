import { cpSync, existsSync, mkdirSync, readdirSync } from "fs";
import { basename, dirname, extname, relative, resolve } from "path";
import chalk from "chalk";

/**
 * Bun File Trace (BFT) — a Bun-native equivalent of Node File Trace (NFT).
 *
 * `Bun.build()` bundles all JavaScript/TypeScript but has no awareness of
 * files accessed at runtime via `node:fs` or `Bun.file()`.  For example:
 *
 * ```ts
 * const prompt = readFileSync("./app/prompts/system.txt", "utf-8");
 * const db = new Database("./app/data/agent.db");
 * const raw = await Bun.file("./app/embeddings.bin").arrayBuffer();
 * ```
 *
 * These paths survive unchanged in the bundle; the files must therefore be
 * present alongside it at runtime.  This module scans every TypeScript/
 * JavaScript source file in `appDir`, extracts **literal-string** path
 * arguments from common `node:fs` functions and `Bun.file()`, and copies the
 * referenced files into the output directory so that deployments are
 * self-contained.
 *
 * Limitation: only compile-time-constant (literal) path strings are detected.
 * Paths assembled at runtime via variables, template literals, or
 * `path.join()` / `path.resolve()` are not traced — the developer must list
 * them explicitly in `build.includes` or copy them manually.
 */

// ---------------------------------------------------------------------------
// Patterns — each regex has exactly one capture group: the file path string.
// We deliberately avoid back-references across quote styles to stay simple.
// ---------------------------------------------------------------------------
const FS_PATTERNS: RegExp[] = [
  // fs.readFileSync("path") / readFileSync("path")
  /\breadFileSync\s*\(\s*["'`]([^"'`\n]+)["'`]/g,
  // fs.readFile("path", ...) / readFile("path", ...)
  /\breadFile\s*\(\s*["'`]([^"'`\n]+)["'`]/g,
  // fs.createReadStream("path")
  /\bcreateReadStream\s*\(\s*["'`]([^"'`\n]+)["'`]/g,
  // fs.existsSync("path")  — agent may gate on file existence at startup
  /\bexistsSync\s*\(\s*["'`]([^"'`\n]+)["'`]/g,
  // fs.statSync / fs.lstatSync
  /\b(?:l?stat)Sync\s*\(\s*["'`]([^"'`\n]+)["'`]/g,
  // Bun.file("path")
  /\bBun\.file\s*\(\s*["'`]([^"'`\n]+)["'`]/g,
];

/** Code-file extensions that are already bundled — never copy these. */
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);

/**
 * Scan every source file under `appDir` and return the de-duplicated set of
 * data-file paths that should be copied to the output directory.
 *
 * `cwd` is the project root — the directory from which the deployed server
 * will be started.  Literal paths like `"./app/prompts/system.txt"` in agent
 * source code are relative to this directory at runtime, so we must resolve
 * them against it when checking existence.
 *
 * Returned paths are **absolute**.
 */
export async function traceFileSystemAssets(appDir: string, cwd = process.cwd()): Promise<string[]> {
  const found = new Set<string>();
  const glob = new Bun.Glob("**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}");

  for await (const rel of glob.scan({ cwd: appDir, onlyFiles: true })) {
    const srcFile = resolve(appDir, rel);
    let source: string;
    try {
      source = await Bun.file(srcFile).text();
    } catch {
      continue;
    }

    const srcDir = dirname(srcFile);

    for (const pattern of FS_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source)) !== null) {
        const raw = match[1];

        // Skip anything that looks like a variable, env-var interpolation, or
        // an absolute system path outside the project (e.g. /etc/ssl/certs).
        if (raw.includes("${") || raw.startsWith("/")) continue;

        // Resolve relative to the project root (the runtime CWD — the most
        // common pattern) and also to the source file's directory (for code
        // using `path.resolve(import.meta.dir, "...")`).
        for (const base of [cwd, srcDir]) {
          const abs = resolve(base, raw);
          if (existsSync(abs) && !CODE_EXTENSIONS.has(extname(abs))) {
            found.add(abs);
          }
        }
      }
    }
  }

  return [...found];
}

/**
 * Copy traced data files into `outputDir`, preserving each file's path
 * relative to `cwd` so that CWD-relative reads (the most common pattern)
 * continue to work when the server is started from the output directory.
 *
 * Example: `./app/prompts/system.txt` → `<outputDir>/app/prompts/system.txt`
 */
export async function copyTracedFiles(tracedFiles: string[], cwd: string, outputDir: string): Promise<void> {
  if (tracedFiles.length === 0) return;

  let copied = 0;
  for (const file of tracedFiles) {
    const rel = relative(cwd, file);
    // Skip files that resolved outside the project root.
    if (rel.startsWith("..")) continue;

    const dest = resolve(outputDir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    try {
      cpSync(file, dest);
      copied++;
    } catch {
      // Silently skip unreadable files.
    }
  }

  if (copied > 0) {
    console.log(chalk.dim(`  Traced ${copied} data file(s) to output`));
  }
}

/** Names of icon files already handled by the icons pipeline — skip them. */
const ICON_NAMES = new Set(["icon.svg", "icon.png", "icon.jpeg", "icon.jpg"]);

/**
 * Copy all **non-code** files from `appDir` into `outputDir/app/<rel>` whose
 * paths satisfy the project's `build.outputFileTracingIncludes` /
 * `build.outputFileTracingExcludes` glob patterns (the same contract as
 * Next.js `outputFileTracingIncludes` / `outputFileTracingExcludes`, but
 * scoped to a single agent build rather than per-route).
 *
 * This is a complementary sweep that catches files an agent loads via
 * `node:fs` with a path relative to `import.meta.dir` rather than `cwd`, or
 * that are never referenced in source code at all (e.g. a template directory
 * scanned with `fs.readdirSync`).  Files explicitly referenced by literal
 * `readFileSync` / `Bun.file()` calls are already handled by
 * {@link traceFileSystemAssets} and do not need to be listed here.
 *
 * Code files (`.ts`, `.tsx`, …) are always skipped because they are already
 * inlined by `Bun.build()`.  Icon files are skipped because they are handled
 * by the icons pipeline.
 *
 * A file is included when it matches at least one `outputFileTracingIncludes`
 * pattern **and** does not match any `outputFileTracingExcludes` pattern —
 * identical to how `AixyzGlob` works for source files in `AixyzServerPlugin`.
 */
export async function copyAppAssets(
  appDir: string,
  outputDir: string,
  outputFileTracingIncludes: string[],
  outputFileTracingExcludes: string[],
): Promise<void> {
  const glob = new Bun.Glob("**/*");
  let copied = 0;

  for await (const rel of glob.scan({ cwd: appDir, onlyFiles: true })) {
    const ext = extname(rel);
    const name = basename(rel);
    if (CODE_EXTENSIONS.has(ext)) continue;
    if (ICON_NAMES.has(name)) continue;

    // Apply outputFileTracingIncludes / outputFileTracingExcludes.
    const included = outputFileTracingIncludes.some((pattern) => new Bun.Glob(pattern).match(rel));
    if (!included) continue;
    const excluded = outputFileTracingExcludes.some((pattern) => new Bun.Glob(pattern).match(rel));
    if (excluded) continue;

    const src = resolve(appDir, rel);
    const dest = resolve(outputDir, "app", rel);
    mkdirSync(dirname(dest), { recursive: true });
    try {
      cpSync(src, dest);
      copied++;
    } catch {
      // skip
    }
  }

  if (copied > 0) {
    console.log(chalk.dim(`  Copied ${copied} app asset(s) to output`));
  }
}
