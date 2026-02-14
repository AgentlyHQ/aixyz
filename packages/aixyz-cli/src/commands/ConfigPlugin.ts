import type { BunPlugin } from "bun";
import { resolve } from "path";

/**
 * Replaces the dynamic `require()` in `getAixyzConfig()` with a static import
 * of the user's `aixyz.config.ts` so the config is inlined into the bundle.
 */
export function ConfigPlugin(): BunPlugin {
  const configPath = resolve(process.cwd(), "aixyz.config.ts");

  return {
    name: "aixyz-config",
    setup(build) {
      build.onResolve({ filter: /config/ }, (args) => {
        if (!args.resolveDir) return;
        const resolved = resolve(args.resolveDir, args.path);
        if (/\/aixyz\/config(\.ts)?$/.test(resolved)) {
          return { path: "virtual:config", namespace: "aixyz-config" };
        }
      });

      build.onLoad({ filter: /.*/, namespace: "aixyz-config" }, () => {
        return {
          contents: `import _config from "${configPath}";\nexport function getAixyzConfig() { return _config; }\n`,
          loader: "ts",
        };
      });
    },
  };
}
