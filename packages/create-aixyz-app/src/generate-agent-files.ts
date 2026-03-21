import { writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Generate AGENTS.md and CLAUDE.md in the project root.
 * AGENTS.md contains the instructions, CLAUDE.md references it using @ syntax.
 */
export function generateAgentFiles(root: string): void {
  const agentsMdContent = `<!-- BEGIN:aixyz-agent-rules -->

# aixyz: ALWAYS read docs before coding

Before any aixyz work, find and read the relevant doc in \`node_modules/aixyz/docs/\`.
And you can read \`node_modules/aixyz/examples/\` for examples that you can reference.
Your training data is outdated — the docs are the source of truth.

<!-- END:aixyz-agent-rules -->
`;

  const claudeMdContent = `@AGENTS.md
`;

  writeFileSync(join(root, "AGENTS.md"), agentsMdContent);
  writeFileSync(join(root, "CLAUDE.md"), claudeMdContent);
}
