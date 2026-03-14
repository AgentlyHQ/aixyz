import type { AixyzApp } from "aixyz/app";

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
 * Converts an {@link AixyzApp} into Next.js Route Handler exports.
 *
 * This adapter bridges the web-standard `Request`/`Response` API used by
 * `AixyzApp` with Next.js App Router Route Handlers. Because both Next.js
 * and `AixyzApp` use web-standard `Request`/`Response`, no conversion is
 * needed — requests are forwarded directly to `app.fetch()`.
 *
 * The returned object contains named exports for every HTTP method
 * (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`) so you can
 * spread or destructure them directly in your route file.
 *
 * **Important:** Call `app.initialize()` before passing the app to this
 * function, or call it once at module level so initialization runs at cold
 * start rather than per-request.
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
 * import { MCPPlugin } from "aixyz/app/plugins/mcp";
 * import * as agent from "../../agent";
 *
 * const app = new AixyzApp();
 * await app.withPlugin(new A2APlugin(agent));
 * await app.withPlugin(new MCPPlugin([{ name: "agent", exports: agent }]));
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
