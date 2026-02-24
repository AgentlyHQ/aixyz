import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadEnvConfig as loadEnvConfigNext } from "@next/env";

function findProjectRoot(from: string): string {
  let dir = resolve(from);
  while (true) {
    if (existsSync(join(dir, "aixyz.config.ts"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return from;
    }
    dir = parent;
  }
}

/**
 * There is a small difference between test environment, and both development and production that you need to bear in
 * mind: .env.local won't be loaded, as you expect tests to produce the same results for everyone. This way every test
 * execution will use the same env defaults across different executions by ignoring your .env.local (which is intended
 * to override the default set).
 *
 * You can use .env.test.local if you want to use local overrides for tests only.
 */
export function loadEnv(cwd = process.cwd(), dev = true) {
  loadEnvConfigNext(findProjectRoot(cwd), dev);
}
