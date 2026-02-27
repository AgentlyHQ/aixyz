import { getAixyzConfig } from "@aixyz/config";
import type { BunPlugin } from "bun";
import boxen from "boxen";
import chalk from "chalk";

export function AixyzConfigPlugin(): BunPlugin {
  const materialized = getAixyzConfig();

  const maxLen = Math.max(materialized.url.length, materialized.x402.payTo.length);
  const description =
    materialized.description.length > maxLen
      ? materialized.description.slice(0, maxLen - 1) + "…"
      : materialized.description;

  const labels = ["Name", "Description", "URL", "Version", "x402 PayTo", "x402 Network"];
  if (materialized.x402.facilitatorUrl) labels.push("x402 Facilitator");
  // get max length of labels for padding
  const pad = Math.max(...labels.map((l) => l.length)) + 2;
  const label = (text: string) => chalk.dim(text.padEnd(pad));

  const lines = [
    `${label("Name")}${materialized.name}`,
    `${label("Description")}${description}`,
    `${label("URL")}${materialized.url}`,
    `${label("Version")}${materialized.version}`,
    `${label("x402 PayTo")}${materialized.x402.payTo}`,
    `${label("x402 Network")}${materialized.x402.network}`,
    ...(materialized.x402.facilitatorUrl ? [`${label("x402 Facilitator")}${materialized.x402.facilitatorUrl}`] : []),
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
