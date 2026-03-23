import { getAixyzConfig } from "@aixyz/config";
import type { BunPlugin } from "bun";
import boxen from "boxen";
import chalk from "chalk";

function label(text: string): string {
  return chalk.dim(text.padEnd(16));
}

function logConfig(materialized: ReturnType<typeof getAixyzConfig>): void {
  const refLen = materialized.url?.length ?? 0;
  const payLen = materialized.x402?.payTo?.length ?? materialized.mpp?.recipient?.length ?? 0;
  const maxLen = Math.max(refLen, payLen);
  const description =
    materialized.description.length > maxLen
      ? materialized.description.slice(0, maxLen - 1) + "…"
      : materialized.description;

  const lines = [
    `${label("Name")}${materialized.name}`,
    `${label("Description")}${description}`,
    `${label("URL")}${materialized.url}`,
    `${label("Version")}${materialized.version}`,
  ];

  if (materialized.x402) {
    lines.push(
      `${label("x402 PayTo")}${materialized.x402.payTo}`,
      `${label("x402 Network")}${materialized.x402.network}`,
    );
  }

  if (materialized.mpp) {
    lines.push(
      `${label("MPP Recipient")}${materialized.mpp.recipient}`,
      `${label("MPP Methods")}${(materialized.mpp.methods ?? ["tempo"]).join(", ")}`,
    );
  }

  console.log(
    boxen(lines.join("\n"), {
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      borderStyle: "round",
      borderColor: "green",
      title: "aixyz.config.ts",
      titleAlignment: "left",
    }),
  );
}

export function AixyzConfigPlugin(): BunPlugin {
  const materialized = getAixyzConfig();
  logConfig(materialized);

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
