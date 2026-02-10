import type { BunPlugin } from "bun";
import { loadAixyzConfig } from "../../config";

export async function AixyzConfigPlugin(): Promise<BunPlugin> {
  const materialized = loadAixyzConfig();

  console.log("AixyzConfig loaded:", materialized);

  return {
    name: "aixyz-config",
    setup(build) {
      build.onLoad({ filter: /packages\/aixyz\/config\.ts$/ }, () => ({
        contents: `
        const config = ${JSON.stringify(materialized)};
        export function loadAixyzConfig() {
          return config;
        }
      `,
        loader: "ts",
      }));
    },
  };
}
