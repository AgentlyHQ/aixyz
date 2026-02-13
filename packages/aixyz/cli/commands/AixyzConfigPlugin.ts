import type { BunPlugin } from "bun";
import { getAixyzConfig } from "../../config";

export async function AixyzConfigPlugin(): Promise<BunPlugin> {
  const materialized = getAixyzConfig();

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
