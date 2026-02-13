import type { BunPlugin } from "bun";
import { getAixyzConfig } from "../../config";

export function ConfigPlugin(): BunPlugin {
  const materialized = getAixyzConfig();

  // TODO(@fuxingloh): change how this is formatted
  console.log("AixyzConfig loaded:", materialized);

  return {
    name: "aixyz-config",
    setup(build) {
      build.onLoad({ filter: /packages\/aixyz\/config\.ts$/ }, () => ({
        contents: `
        const config = ${JSON.stringify(materialized)};
        export function getAixyzConfig() {
          return config;
        }
      `,
        loader: "ts",
      }));
    },
  };
}
