import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";

export function writeResultJson(outDir: string, filenamePrefix: string, result: { chainId: number }): void {
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const filename = `${filenamePrefix}-${result.chainId}-${Date.now()}.json`;
  const filePath = join(outDir, filename);
  writeFileSync(filePath, JSON.stringify(result, null, 2) + "\n");
  console.log(`\n${chalk.green("✓")} Result written to ${chalk.bold(filePath)}`);
}
