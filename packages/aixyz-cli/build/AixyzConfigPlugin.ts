import { getAixyzConfig } from "@aixyz/config";
import type { BunPlugin } from "bun";

export function AixyzConfigPlugin(): BunPlugin {
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
