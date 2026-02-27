import type { BunPlugin } from "bun";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { resolve, relative, basename, join } from "path";
import { getAixyzConfig } from "@aixyz/config";

export function AixyzServerPlugin(entrypoint: string, mode: "vercel" | "standalone"): BunPlugin {
  return {
    name: "aixyz-entrypoint",
    setup(build) {
      build.onLoad({ filter: /server\.ts$/ }, async (args) => {
        if (args.path !== entrypoint) return;

        const source = await Bun.file(args.path).text();

        if (mode === "vercel") {
          // For Vercel, export server.express for serverless function
          const transformed = source.replace(/export\s+default\s+(\w+)\s*;/, "export default $1.express;");
          return { contents: transformed, loader: "ts" };
        } else {
          // For standalone, keep the server export but add startup code
          // TODO(@fuxingloh): use Bun.serve later.
          const transformed = source.replace(
            /export\s+default\s+(\w+)\s*;/,
            `export default $1;

// Auto-start server when run directly
if (import.meta.main) {
  const port = parseInt(process.env.PORT || "3000", 10);
  $1.express.listen(port, () => {
    console.log(\`Server listening on port \${port}\`);
  });
}`,
          );
          return { contents: transformed, loader: "ts" };
        }
      });
    },
  };
}

export function getEntrypointMayGenerate(cwd: string, mode: "dev" | "build"): string {
  const appDir = resolve(cwd, "app");

  if (existsSync(resolve(appDir, "server.ts"))) {
    return resolve(appDir, "server.ts");
  }

  const devDir = resolve(cwd, join(".aixyz", mode));
  mkdirSync(devDir, { recursive: true });
  const entrypoint = resolve(devDir, "server.ts");
  writeFileSync(entrypoint, generateServer(appDir, devDir));
  return entrypoint;
}

class AixyzGlob {
  constructor(readonly config = getAixyzConfig()) {}

  includes(file: string): boolean {
    const included = this.config.build.includes.some((pattern) => new Bun.Glob(pattern).match(file));
    if (!included) return false;
    const excluded = this.config.build.excludes.some((pattern) => new Bun.Glob(pattern).match(file));
    return !excluded;
  }
}

/**
 * Generate server.ts content by scanning the app directory for agent.ts and tools/.
 *
 * @param appDir - The app directory containing agent.ts and tools/
 * @param entrypointDir - Directory where the generated file will live (for computing relative imports).
 */
function generateServer(appDir: string, entrypointDir: string): string {
  const glob = new AixyzGlob();
  const rel = relative(entrypointDir, appDir);
  const importPrefix = rel === "" ? "." : rel.startsWith(".") ? rel : `./${rel}`;

  const imports: string[] = [];
  const body: string[] = [];

  imports.push('import { AixyzServer } from "aixyz/server";');

  const hasAccepts = existsSync(resolve(appDir, "accepts.ts"));
  if (hasAccepts) {
    imports.push(`import { facilitator } from "${importPrefix}/accepts";`);
  } else if (glob.config.x402.facilitatorUrl) {
    imports.push('import { createFacilitator } from "aixyz/accepts";');
    imports.push(`const facilitator = createFacilitator(${JSON.stringify(glob.config.x402.facilitatorUrl)});`);
  } else {
    imports.push('import { facilitator } from "aixyz/accepts";');
  }

  const hasAgent = existsSync(resolve(appDir, "agent.ts")) && glob.includes("agent.ts");
  if (hasAgent) {
    imports.push('import { useA2A } from "aixyz/server/adapters/a2a";');
    imports.push(`import * as agent from "${importPrefix}/agent";`);
  }

  const toolsDir = resolve(appDir, "tools");
  const tools: { name: string; identifier: string }[] = [];
  if (existsSync(toolsDir)) {
    for (const file of readdirSync(toolsDir)) {
      if (glob.includes(`tools/${file}`)) {
        const name = basename(file, ".ts");
        const identifier = toIdentifier(name);
        tools.push({ name, identifier });
      }
    }
  }

  if (tools.length > 0) {
    imports.push('import { AixyzMCP } from "aixyz/server/adapters/mcp";');
    for (const tool of tools) {
      imports.push(`import * as ${tool.identifier} from "${importPrefix}/tools/${tool.name}";`);
    }
  }

  body.push("const server = new AixyzServer(facilitator);");
  body.push("await server.initialize();");
  body.push("server.unstable_withIndexPage();");

  if (hasAgent) {
    body.push("useA2A(server, agent);");
  }

  if (tools.length > 0) {
    body.push("const mcp = new AixyzMCP(server);");
    for (const tool of tools) {
      body.push(`await mcp.register("${tool.name}", ${tool.identifier});`);
    }
    body.push("await mcp.connect();");
  }

  // If app/erc-8004.ts exists, auto-register ERC-8004 endpoint
  const hasErc8004 = existsSync(resolve(appDir, "erc-8004.ts"));
  if (hasErc8004) {
    imports.push('import { useERC8004 } from "aixyz/server/adapters/erc-8004";');
    imports.push(`import * as erc8004 from "${importPrefix}/erc-8004";`);
    body.push(
      `useERC8004(server, { default: erc8004.default, options: { mcp: ${tools.length > 0}, a2a: ${hasAgent} } });`,
    );
  }

  body.push("export default server;");

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
