import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RegistrationEntry } from "@aixyz/erc-8004/schemas/registration";

function getFilePath(cwd: string = process.cwd()): string {
  return resolve(cwd, "app/erc-8004.ts");
}

export function hasErc8004File(cwd?: string): boolean {
  return existsSync(getFilePath(cwd));
}

export function createErc8004File(supportedTrust: string[], cwd?: string): void {
  const filePath = getFilePath(cwd);
  const trustArray = supportedTrust.map((t) => `"${t}"`).join(", ");

  const content = `import type { ERC8004Registration } from "aixyz/erc-8004";

const metadata: ERC8004Registration = {
  registrations: [],
  supportedTrust: [${trustArray}],
};

export default metadata;
`;

  writeFileSync(filePath, content, "utf-8");
}

export async function readRegistrations(cwd?: string): Promise<RegistrationEntry[]> {
  const filePath = getFilePath(cwd);

  if (!existsSync(filePath)) {
    throw new Error(`No app/erc-8004.ts found. Run \`aixyz erc-8004 register\` first.`);
  }

  const mod = await import(filePath);
  const data = mod.default;

  if (!data || !Array.isArray(data.registrations)) {
    return [];
  }

  return data.registrations;
}

export function writeRegistrationEntry(entry: { agentId: number; agentRegistry: string }, cwd?: string): void {
  const filePath = getFilePath(cwd);
  const content = readFileSync(filePath, "utf-8");
  const entryStr = `{ agentId: ${entry.agentId}, agentRegistry: "${entry.agentRegistry}" }`;

  // Try to find `registrations: [...]` and insert the entry
  const match = content.match(/registrations:\s*\[([^\]]*)\]/s);
  if (match) {
    const existing = match[1]!.trim();
    const newEntries = existing ? `${existing}, ${entryStr}` : entryStr;
    const updated = content.replace(/registrations:\s*\[([^\]]*)\]/s, `registrations: [${newEntries}]`);
    writeFileSync(filePath, updated, "utf-8");
    return;
  }

  // Fallback: append as comment
  const comment = `\n// Registration added by \`aixyz erc-8004 register\`:\n// ${entryStr}\n`;
  writeFileSync(filePath, content + comment, "utf-8");
}
