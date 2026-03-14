import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { AixyzApp } from "aixyz/app";
import { A2APlugin } from "aixyz/app/plugins/a2a";
import { MCPPlugin } from "aixyz/app/plugins/mcp";
import { IndexPagePlugin } from "aixyz/app/plugins/index-page";
import { facilitator } from "aixyz/accepts";
import type { Accepts } from "aixyz/accepts";
import type { Tool, ToolLoopAgent, ToolSet } from "ai";

export type NextRouteHandler = (request: Request) => Promise<Response>;

export interface NextRouteHandlers {
  GET: NextRouteHandler;
  POST: NextRouteHandler;
  PUT: NextRouteHandler;
  DELETE: NextRouteHandler;
  PATCH: NextRouteHandler;
  HEAD: NextRouteHandler;
  OPTIONS: NextRouteHandler;
}

/**
 * Agent module shape — the named exports of an `app/agent.ts` file.
 * The `default` export is the ToolLoopAgent; `accepts` controls x402 payment gating.
 */
export interface AgentModule<TOOLS extends ToolSet = ToolSet> {
  default: ToolLoopAgent<never, TOOLS>;
  accepts?: Accepts;
}

/**
 * Tool module shape — the named exports of a file in `app/tools/`.
 * The `default` export is the Tool; `accepts` controls per-tool MCP payment gating.
 */
export interface ToolModule {
  default: Tool;
  accepts?: Accepts;
}

/**
 * Options for {@link createNextHandler}.
 */
export interface CreateNextHandlerOptions {
  /**
   * Root agent module (re-export of `app/agent.ts`).
   * Wires up an A2A endpoint (`/agent`) and the well-known agent card.
   */
  agent?: AgentModule;
  /**
   * Tool modules to expose over MCP (`/mcp`).
   * Each entry needs a `name` (used as the MCP tool name) and the tool's module exports.
   */
  tools?: Array<{ name: string; exports: ToolModule }>;
}

/**
 * Create Next.js App Router Route Handler exports from agent and tool modules — with zero boilerplate.
 *
 * Pass your `app/agent.ts` and `app/tools/*.ts` module exports and get back ready-to-use
 * HTTP method handlers. Plugins (`A2APlugin`, `MCPPlugin`, `IndexPagePlugin`) are wired up
 * automatically, and the app is lazy-initialized on the first request so cold starts are
 * not penalised.
 *
 * @example
 * ```ts
 * // app/api/[[...route]]/route.ts
 * import { createNextHandler } from "@aixyz/next";
 * import * as agent from "../../agent";
 * import * as weatherTool from "../../tools/weather";
 *
 * export const { GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS } = createNextHandler({
 *   agent,
 *   tools: [{ name: "weather", exports: weatherTool }],
 * });
 * ```
 *
 * @param options - Agent and tool module exports to wire up.
 * @returns An object of Next.js Route Handler functions keyed by HTTP method.
 */
export function createNextHandler(options: CreateNextHandlerOptions = {}): NextRouteHandlers {
  let initPromise: Promise<AixyzApp> | null = null;

  async function getApp(): Promise<AixyzApp> {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const app = new AixyzApp(facilitator ? { facilitators: facilitator } : undefined);
      await app.withPlugin(new IndexPagePlugin());

      if (options.agent) {
        await app.withPlugin(new A2APlugin(options.agent));
      }

      if (options.tools && options.tools.length > 0) {
        await app.withPlugin(new MCPPlugin(options.tools));
      }

      await app.initialize();
      return app;
    })();

    return initPromise;
  }

  const handler: NextRouteHandler = async (request: Request) => {
    const app = await getApp();
    return app.fetch(request);
  };

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    DELETE: handler,
    PATCH: handler,
    HEAD: handler,
    OPTIONS: handler,
  };
}

/**
 * Low-level adapter: converts a fully-configured {@link AixyzApp} instance into
 * Next.js App Router Route Handler exports.
 *
 * Use {@link createNextHandler} unless you need full control over the `AixyzApp`
 * setup (custom plugins, custom payment facilitators, etc.).
 *
 * **Important:** Call `app.initialize()` before passing the app here.
 *
 * @param app - A fully initialized {@link AixyzApp} instance.
 * @returns An object of Next.js Route Handler functions keyed by HTTP method.
 *
 * @example
 * ```ts
 * // app/api/[[...route]]/route.ts
 * import { toNextRouteHandler } from "@aixyz/next";
 * import { AixyzApp } from "aixyz/app";
 * import { A2APlugin } from "aixyz/app/plugins/a2a";
 * import * as agent from "../../agent";
 *
 * const app = new AixyzApp();
 * await app.withPlugin(new A2APlugin(agent));
 * await app.initialize();
 *
 * export const { GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS } = toNextRouteHandler(app);
 * ```
 */
export function toNextRouteHandler(app: AixyzApp): NextRouteHandlers {
  const handler: NextRouteHandler = (request: Request) => app.fetch(request);

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    DELETE: handler,
    PATCH: handler,
    HEAD: handler,
    OPTIONS: handler,
  };
}

// ---------------------------------------------------------------------------
// Next.js config integration
// ---------------------------------------------------------------------------

/**
 * Minimal Next.js config shape — avoids a hard runtime dependency on `next` for types.
 * Compatible with `NextConfig` from `next`.
 */
export type NextConfig = {
  webpack?: (config: WebpackConfig, options: WebpackOptions) => WebpackConfig;
  transpilePackages?: string[];
  experimental?: Record<string, unknown>;
  [key: string]: unknown;
};

type WebpackConfig = {
  resolve?: { alias?: Record<string, string | false>; [key: string]: unknown };
  [key: string]: unknown;
};

type WebpackOptions = {
  isServer: boolean;
  dir: string;
  [key: string]: unknown;
};

/**
 * Wraps a Next.js config to automatically wire up `./app/agent.ts` and `./app/tools/*.ts`
 * as A2A/MCP endpoints — zero manual imports required.
 *
 * On startup, `withAixyzConfig` scans your project's `app/` directory, generates a
 * route handler in `.next/cache/aixyz/route.mjs`, and adds a webpack alias so that
 * `@aixyz/next/route` resolves to that generated handler.
 *
 * If `app/api/[[...route]]/route.ts` doesn't exist yet, it is auto-created with a single
 * re-export line — the only file you ever need to commit.
 *
 * @example
 * ```ts
 * // next.config.ts
 * import { withAixyzConfig } from "@aixyz/next";
 * export default withAixyzConfig({});
 * ```
 *
 * That's it — no route file imports, no plugin wiring, nothing else.
 */
export function withAixyzConfig(nextConfig: NextConfig = {}): NextConfig {
  const cwd = process.cwd();

  // Auto-create the catch-all route file if the project doesn't have one yet.
  ensureRouteFile(cwd);

  // Generate the handler code into .next/cache/ and obtain its absolute path.
  const generatedRoute = generateAixyzRoute(cwd);

  return {
    ...nextConfig,
    webpack(config: WebpackConfig, options: WebpackOptions) {
      // Redirect @aixyz/next/route to the auto-generated handler so that
      // `export ... from "@aixyz/next/route"` picks up the scanned agent/tools.
      config.resolve = {
        ...config.resolve,
        alias: {
          ...(config.resolve?.alias ?? {}),
          "@aixyz/next/route": generatedRoute,
        },
      };

      if (typeof nextConfig.webpack === "function") {
        return nextConfig.webpack(config, options);
      }
      return config;
    },
  };
}

/**
 * Auto-create `app/api/[[...route]]/route.ts` if it doesn't exist.
 * The created file is a stable one-liner that is safe to commit.
 *
 * @internal
 */
export function ensureRouteFile(cwd: string): void {
  const routeDir = join(cwd, "app", "api", "[[...route]]");
  const routeFile = join(routeDir, "route.ts");

  if (existsSync(routeFile)) return;

  mkdirSync(routeDir, { recursive: true });
  writeFileSync(
    routeFile,
    `// Auto-generated by @aixyz/next — safe to commit\nexport { GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS } from "@aixyz/next/route";\n`,
  );
}

/**
 * Scan `<cwd>/app/agent.ts` and `<cwd>/app/tools/*.ts`, generate a self-contained
 * route handler module in `.next/cache/aixyz/route.mjs`, and return its absolute path.
 *
 * The generated `.mjs` file is plain JavaScript ESM that imports directly from the
 * discovered source files; Next.js / webpack applies TypeScript compilation to those
 * imports as normal.
 *
 * Files starting with `_` in `tools/` are excluded (matching the CLI convention).
 *
 * @internal
 */
export function generateAixyzRoute(cwd: string): string {
  const appDir = join(cwd, "app");
  const toolsDir = join(appDir, "tools");

  // Locate app/agent.{ts,js}
  const agentFile = ["agent.ts", "agent.js"].map((f) => join(appDir, f)).find(existsSync);

  const cacheDir = join(cwd, ".next", "cache", "aixyz");
  mkdirSync(cacheDir, { recursive: true });

  const lines: string[] = [
    `// Auto-generated by @aixyz/next — DO NOT EDIT`,
    `import { createNextHandler } from "@aixyz/next";`,
  ];
  const opts: string[] = [];

  if (agentFile) {
    lines.push(`import * as __agent from ${JSON.stringify(agentFile)};`);
    opts.push(`  agent: __agent,`);
  }

  const toolEntries: string[] = [];
  if (existsSync(toolsDir)) {
    for (const file of readdirSync(toolsDir).sort()) {
      // Mirror CLI convention: skip _ prefixed files, include .ts and .js
      if (/^[^_].*\.[jt]s$/.test(file)) {
        const name = file.replace(/\.[jt]s$/, "");
        const id = `__tool_${name.replace(/[^a-zA-Z0-9]/g, "_")}`;
        lines.push(`import * as ${id} from ${JSON.stringify(join(toolsDir, file))};`);
        toolEntries.push(`    { name: ${JSON.stringify(name)}, exports: ${id} },`);
      }
    }
  }

  if (toolEntries.length > 0) {
    opts.push(`  tools: [\n${toolEntries.join("\n")}\n  ],`);
  }

  lines.push(``);
  lines.push(`export const { GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS } = createNextHandler({`);
  lines.push(...opts);
  lines.push(`});`);

  const routePath = join(cacheDir, "route.mjs");
  writeFileSync(routePath, lines.join("\n"), "utf-8");
  return routePath;
}
