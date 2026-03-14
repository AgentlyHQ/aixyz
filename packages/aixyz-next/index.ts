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
