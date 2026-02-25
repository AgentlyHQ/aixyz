import type { BunPlugin } from "bun";
import { cpSync, mkdirSync } from "fs";
import { dirname, relative, resolve } from "path";
import chalk from "chalk";

/**
 * Bun File Trace (BFT) — a Bun-native equivalent of Node File Trace (NFT).
 *
 * Bun's bundler inlines all JavaScript/TypeScript but cannot bundle native
 * Node add-ons (.node files); those remain external and must be present at
 * runtime alongside the bundle.  This plugin intercepts `.node` resolutions
 * during `Bun.build()` so that they can be collected and then copied into the
 * output directory via {@link copyTracedFiles}.
 *
 * Usage:
 * ```ts
 * const traced: string[] = [];
 * await Bun.build({ ..., plugins: [AixyzBFTPlugin(traced)] });
 * await copyTracedFiles(traced, cwd, outputDir);
 * ```
 */
export function AixyzBFTPlugin(tracedFiles: string[]): BunPlugin {
  return {
    name: "aixyz-bft",
    setup(build) {
      // Intercept every .node resolution so we can record and externalise it.
      build.onResolve({ filter: /\.node$/ }, (args) => {
        try {
          const basedir = args.importer ? dirname(args.importer) : process.cwd();
          const resolved = require.resolve(args.path, { paths: [basedir] });
          tracedFiles.push(resolved);
          return { path: resolved, external: true };
        } catch {
          // Resolution failed (e.g. optional platform-specific binary) — still
          // mark as external so the bundler does not error out.
          return { external: true };
        }
      });
    },
  };
}

/**
 * Copy traced native files into `outputDir`, preserving each file's path
 * relative to `cwd` so that runtime module resolution (e.g.
 * `node_modules/pkg/build/Release/pkg.node`) continues to work next to the
 * bundle.
 */
export async function copyTracedFiles(tracedFiles: string[], cwd: string, outputDir: string): Promise<void> {
  if (tracedFiles.length === 0) return;

  let copied = 0;
  for (const file of tracedFiles) {
    const rel = relative(cwd, file);
    // Ignore files outside the project root (e.g. system libraries).
    if (rel.startsWith("..")) continue;

    const dest = resolve(outputDir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    try {
      cpSync(file, dest);
      copied++;
    } catch {
      // Platform-specific binaries that are absent in the current environment
      // (e.g. a Linux .node built for arm64 on an x64 machine) are silently
      // skipped — the correct binary will be present at deploy time.
    }
  }

  if (copied > 0) {
    console.log(chalk.dim(`  Traced ${copied} native file(s) to output`));
  }
}
