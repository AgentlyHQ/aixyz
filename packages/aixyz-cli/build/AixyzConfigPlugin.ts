import { getAixyzConfig } from "@aixyz/config";
import type { BunPlugin } from "bun";
import boxen from "boxen";
import chalk from "chalk";

function label(text: string): string {
  return chalk.dim(text.padEnd(14));
}

export function AixyzConfigPlugin(): BunPlugin {
  const materialized = getAixyzConfig();

  const maxLen = Math.max(materialized.url.length, materialized.x402.payTo.length);
  const description =
    materialized.description.length > maxLen
      ? materialized.description.slice(0, maxLen - 1) + "…"
      : materialized.description;

  const lines = [
    `${label("Name")}${materialized.name}`,
    `${label("Description")}${description}`,
    `${label("URL")}${materialized.url}`,
    `${label("Version")}${materialized.version}`,
    `${label("x402 PayTo")}${materialized.x402.payTo}`,
    `${label("x402 Network")}${materialized.x402.network}`,
  ];
  console.log(
    boxen(lines.join("\n"), {
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      borderStyle: "round",
      borderColor: "green",
      title: "aixyz.config.ts",
      titleAlignment: "left",
    }),
  );

  return {
    name: "aixyz-config",
    setup(build) {
      build.onLoad({ filter: /aixyz[-/]config\/index\.ts$/ }, () => ({
        contents: `
        const config = ${JSON.stringify(materialized)};
        export function getAixyzConfig() {
          return config;
        }
        export function getAixyzConfigRuntime() {
          return config;
        }
      `,
        loader: "ts",
      }));
    },
  };
}
