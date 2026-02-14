import type { BunPlugin } from "bun";
import { resolve } from "path";

/**
 * Wraps the user's entrypoint so the bundled output exports the Express app
 * (extracted from AixyzApp) as the default export for Vercel's Node.js runtime.
 */
export function EntrypointPlugin(entrypoint: string): BunPlugin {
  const entrypointPath = resolve(entrypoint);
  let intercepted = false;

  return {
    name: "aixyz-entrypoint",
    setup(build) {
      build.onResolve({ filter: /\.ts$/ }, (args) => {
        if (intercepted) return;
        const resolved = args.resolveDir ? resolve(args.resolveDir, args.path) : resolve(args.path);
        if (resolved === entrypointPath) {
          intercepted = true;
          return { path: "virtual:entrypoint", namespace: "aixyz-entrypoint" };
        }
      });

      build.onLoad({ filter: /.*/, namespace: "aixyz-entrypoint" }, () => {
        return {
          contents: [
            `import _mod from "${entrypointPath}";`,
            `const _handler = _mod?.express ?? _mod;`,
            `export default _handler;`,
          ].join("\n"),
          loader: "ts",
        };
      });
    },
  };
}
