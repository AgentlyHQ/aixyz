import type { BunPlugin } from "bun";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { resolve, relative, basename, join } from "path";

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

/**
 * Generate server.ts content by scanning the app directory for agent.ts and tools/.
 *
 * @param appDir - The app directory containing agent.ts and tools/
 * @param entrypointDir - Directory where the generated file will live (for computing relative imports).
 */
function generateServer(appDir: string, entrypointDir: string): string {
  const rel = relative(entrypointDir, appDir);
  const importPrefix = rel === "" ? "." : rel.startsWith(".") ? rel : `./${rel}`;

  const imports: string[] = [];
  const body: string[] = [];

  imports.push('import { AixyzServer } from "aixyz/server";');

  const hasAccepts = existsSync(resolve(appDir, "accepts.ts"));
  if (hasAccepts) {
    imports.push(`import { facilitator } from "${importPrefix}/accepts";`);
  } else {
    imports.push('import { facilitator } from "aixyz/accepts";');
  }

  const hasAgent = existsSync(resolve(appDir, "agent.ts"));
  if (hasAgent) {
    imports.push('import { useA2A } from "aixyz/server/adapters/a2a";');
    imports.push(`import * as agent from "${importPrefix}/agent";`);
  }

  const toolsDir = resolve(appDir, "tools");
  const tools: { name: string }[] = [];
  if (existsSync(toolsDir)) {
    for (const file of readdirSync(toolsDir)) {
      if (file.endsWith(".ts")) {
        const name = basename(file, ".ts");
        // Skip tools starting with underscore
        if (!name.startsWith("_")) {
          tools.push({ name });
        }
      }
    }
  }

  if (tools.length > 0) {
    imports.push('import { AixyzMCP } from "aixyz/server/adapters/mcp";');
    for (const tool of tools) {
      imports.push(`import * as ${tool.name} from "${importPrefix}/tools/${tool.name}";`);
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
      body.push(`await mcp.register("${tool.name}", ${tool.name});`);
    }
    body.push("await mcp.connect();");
  }

  body.push("export default server;");

  return [...imports, "", ...body].join("\n");
}
