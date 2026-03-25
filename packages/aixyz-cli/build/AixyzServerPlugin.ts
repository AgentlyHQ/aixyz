import type { BunPlugin } from "bun";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { resolve, relative, join } from "path";
import { getAixyzConfig } from "@aixyz/config";

export function AixyzServerPlugin(
  entrypoint: string,
  mode: "vercel" | "standalone" | "executable",
  isCustom = false,
): BunPlugin {
  return {
    name: "aixyz-entrypoint",
    setup(build) {
      build.onLoad({ filter: /server\.ts$/ }, async (args) => {
        if (args.path !== entrypoint) return;

        const source = await Bun.file(args.path).text();

        // Custom server.ts manages its own lifecycle — pass through as-is
        if (isCustom || mode === "vercel") {
          return { contents: source, loader: "ts" };
        }

        // For generated entrypoints in standalone/executable, rewrite `export default ...` into Bun.serve().
        // Supports both identifier exports (`export default app;`) and
        // expression exports (`export default new AixyzApp({...});`).
        const identifierRe = /export\s+default\s+(\w+)\s*;/;
        const expressionRe = /export\s+default\s+/;

        let transformed: string;
        const identifierMatch = source.match(identifierRe);
        if (identifierMatch) {
          transformed = source.replace(
            identifierRe,
            `const __server = Bun.serve({ port: parseInt(process.env.PORT || "3000", 10), fetch: ${identifierMatch[1]}.fetch, idleTimeout: 255 });\nconsole.log(\`Server listening on port \${__server.port}\`);`,
          );
        } else if (expressionRe.test(source)) {
          transformed = source.replace(expressionRe, `const __app = `);
          transformed += `\nconst __server = Bun.serve({ port: parseInt(process.env.PORT || "3000", 10), fetch: __app.fetch, idleTimeout: 255 });\nconsole.log(\`Server listening on port \${__server.port}\`);`;
        } else {
          throw new Error(
            `[aixyz] Could not find \`export default\` in entrypoint ${args.path}. ` +
              `Standalone and executable builds require the server entrypoint to use \`export default app;\` ` +
              `or \`export default new AixyzApp({...});\`.`,
          );
        }
        return { contents: transformed, loader: "ts" };
      });
    },
  };
}

export type Entrypoint = { path: string; isCustom: boolean };

export function getEntrypointMayGenerate(cwd: string, appDirName: string, mode: "dev" | "build"): Entrypoint {
  const appDir = resolve(cwd, appDirName);
  const serverFile = resolve(appDir, "server.ts");

  if (existsSync(serverFile)) {
    const source = readFileSync(serverFile, "utf-8");
    // assume that export default has `.fetch` typically `app`
    const hasExportDefault = /export\s+default\s+/.test(source);
    return { path: serverFile, isCustom: !hasExportDefault };
  }

  const devDir = resolve(cwd, join(".aixyz", mode));
  mkdirSync(devDir, { recursive: true });
  const entrypoint = resolve(devDir, "server.ts");
  writeFileSync(entrypoint, generateServer(appDir, devDir));
  return { path: entrypoint, isCustom: false };
}

class AixyzGlob {
  constructor(readonly config = getAixyzConfig()) {}

  hasRootAgent(appDir: string): { file: string } | undefined {
    const file = readdirSync(appDir).find((f) => /^agent\.(js|ts)$/.test(f) && this.includesAgent(f));
    return file ? { file } : undefined;
  }

  getAgents(agentsDir: string): { name: string; identifier: string }[] {
    if (!existsSync(agentsDir)) return [];
    return readdirSync(agentsDir)
      .filter((file) => this.includesAgent(`agents/${file}`))
      .map((file) => {
        const name = file.replace(/\.(js|ts)$/, "");
        return { name, identifier: toIdentifier(name) };
      });
  }

  getTools(toolsDir: string): { name: string; identifier: string }[] {
    if (!existsSync(toolsDir)) return [];
    return readdirSync(toolsDir)
      .filter((file) => this.includesTool(`tools/${file}`))
      .map((file) => {
        const name = file.replace(/\.(js|ts)$/, "");
        return { name, identifier: toIdentifier(name) };
      });
  }

  private includesAgent(file: string): boolean {
    const included = this.config.build.agents.some((pattern) => new Bun.Glob(pattern).match(file));
    if (!included) return false;
    const excluded = this.config.build.excludes.some((pattern) => new Bun.Glob(pattern).match(file));
    return !excluded;
  }

  private includesTool(file: string): boolean {
    const included = this.config.build.tools.some((pattern) => new Bun.Glob(pattern).match(file));
    if (!included) return false;
    const excluded = this.config.build.excludes.some((pattern) => new Bun.Glob(pattern).match(file));
    return !excluded;
  }
}

/**
 * Generate server.ts content by scanning the app directory for agent.ts, agents/, and tools/.
 *
 * @param appDir - The app directory containing agent.ts, agents/, and tools/
 * @param entrypointDir - Directory where the generated file will live (for computing relative imports).
 */
function generateServer(appDir: string, entrypointDir: string): string {
  const glob = new AixyzGlob();
  const rel = relative(entrypointDir, appDir);
  const importPrefix = rel === "" ? "." : rel.startsWith(".") ? rel : `./${rel}`;

  const imports: string[] = [];
  const body: string[] = [];

  imports.push('import { AixyzApp } from "aixyz/app";');
  imports.push('import { IndexPagePlugin } from "aixyz/app/plugins/index-page";');
  imports.push('import { MetadataPlugin } from "aixyz/app/plugins/metadata";');

  const hasAccepts = existsSync(resolve(appDir, "accepts.ts"));
  if (hasAccepts) {
    imports.push(`import { facilitator } from "${importPrefix}/accepts";`);
  } else {
    imports.push('import { facilitator } from "aixyz/accepts";');
  }

  const rootAgent = glob.hasRootAgent(appDir);
  const agentsDir = resolve(appDir, "agents");
  const subAgents = glob.getAgents(agentsDir);
  const needsA2A = rootAgent || subAgents.length > 0;

  if (needsA2A) {
    imports.push('import { A2APlugin } from "aixyz/app/plugins/a2a";');
  }
  if (rootAgent) {
    imports.push(`import * as agent from "${importPrefix}/agent";`);
  }
  for (const subAgent of subAgents) {
    imports.push(`import * as ${subAgent.identifier} from "${importPrefix}/agents/${subAgent.name}";`);
  }

  const toolsDir = resolve(appDir, "tools");
  const tools = glob.getTools(toolsDir);

  if (tools.length > 0) {
    imports.push('import { MCPPlugin } from "aixyz/app/plugins/mcp";');
    for (const tool of tools) {
      imports.push(`import * as ${tool.identifier} from "${importPrefix}/tools/${tool.name}";`);
    }
  }

  // If app/erc-8004.ts exists, auto-register ERC-8004 endpoint
  const hasErc8004 = existsSync(resolve(appDir, "erc-8004.ts"));
  if (hasErc8004) {
    imports.push('import { ERC8004Plugin } from "aixyz/app/plugins/erc-8004";');
    imports.push(`import * as erc8004 from "${importPrefix}/erc-8004";`);
  }

  body.push("const app = new AixyzApp({ facilitators: facilitator });");
  body.push("await app.withPlugin(new IndexPagePlugin());");
  body.push("await app.withPlugin(new MetadataPlugin());");

  if (needsA2A) {
    const agentEntries: string[] = [];
    if (rootAgent) {
      agentEntries.push("  { exports: agent },");
    }
    for (const subAgent of subAgents) {
      agentEntries.push(`  { name: "${subAgent.name}", exports: ${subAgent.identifier} },`);
    }
    body.push("await app.withPlugin(new A2APlugin([");
    for (const entry of agentEntries) {
      body.push(entry);
    }
    body.push("]));");
  }

  if (tools.length > 0) {
    const toolEntries = tools.map((tool) => `  { name: "${tool.name}", exports: ${tool.identifier} },`);
    body.push(`await app.withPlugin(new MCPPlugin([`);
    for (const entry of toolEntries) {
      body.push(entry);
    }
    body.push(`]));`);
  }

  if (hasErc8004) {
    const a2aPaths: string[] = [];
    if (rootAgent) a2aPaths.push("/.well-known/agent-card.json");
    for (const subAgent of subAgents) a2aPaths.push(`/${subAgent.name}/.well-known/agent-card.json`);
    body.push(
      `await app.withPlugin(new ERC8004Plugin({ default: erc8004.default, options: { mcp: ${tools.length > 0}, a2a: ${JSON.stringify(a2aPaths)} } }));`,
    );
  }

  body.push("await app.initialize();");
  body.push("export default app;");

  return [...imports, "", ...body].join("\n");
}

/**
 * Convert a kebab-case filename into a valid JS identifier.
 *
 * Examples:
 *  "lookup"                    → "lookup"
 *  "get-aggregator-v3-address" → "getAggregatorV3Address"
 *  "3d-model"                  → "_3dModel"
 */
function toIdentifier(name: string): string {
  const camel = name.replace(/-(.)/g, (_, c: string) => c.toUpperCase()).replace(/[^a-zA-Z0-9_$]/g, "_");
  return /^\d/.test(camel) ? `_${camel}` : camel;
}
