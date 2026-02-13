import type { BunPlugin } from "bun";

export function AixyzEntrypointPlugin(entrypoint: string): BunPlugin {
  return {
    name: "aixyz-entrypoint",
    setup(build) {
      build.onLoad({ filter: /app\.ts$/ }, async (args) => {
        if (args.path !== entrypoint) return;

        const source = await Bun.file(args.path).text();
        const transformed = source.replace(/export\s+default\s+(\w+)\s*;/, "export default $1.express;");

        return { contents: transformed, loader: "ts" };
      });
    },
  };
}
