import type { IncomingMessage } from "node:http";
import type { AixyzApp } from "../index";

/** Minimal request shape compatible with both Node's IncomingMessage and Express's Request. */
interface NodeRequest {
  headers: IncomingMessage["headers"];
  url?: string;
  method?: string;
}

/** Minimal response shape compatible with both Node's ServerResponse and Express's Response. */
interface NodeResponse {
  writeHead(statusCode: number, headers?: Record<string, string>): this;
  write(chunk: unknown): boolean;
  end(): this;
}

/**
 * Converts an {@link AixyzApp} into Express-compatible middleware.
 *
 * This adapter bridges the web-standard `Request`/`Response` API used by
 * `AixyzApp` with Express's Node-style `(req, res, next)` middleware signature.
 * Incoming Express requests are converted to web-standard `Request` objects,
 * routed through `app.fetch()`, and the resulting `Response` is streamed back
 * to the Express response. If the `AixyzApp` does not match the request
 * (404), control is passed to the next Express middleware via `next()`.
 *
 * The returned middleware handles all AixyzApp concerns — A2A, MCP, x402
 * payment verification, and any registered plugins — so you can mount it
 * alongside your own Express routes without conflict.
 *
 * **Important:** Do not apply `express.json()` or other body-parsing middleware
 * before this middleware, as it needs access to the raw request body stream.
 *
 * @param app - A fully initialized {@link AixyzApp} instance (call
 *   `app.initialize()` before passing it here).
 * @returns An async Express middleware function `(req, res, next) => void`.
 *
 * @example
 * ```ts
 * import express from "express";
 * import { AixyzApp } from "aixyz/app";
 * import { toExpressMiddleware } from "aixyz/app/adapters/express";
 * import { A2APlugin } from "aixyz/app/plugins/a2a";
 * import { MCPPlugin } from "aixyz/app/plugins/mcp";
 * import * as agent from "./agent";
 * import * as myTool from "./tools/my-tool";
 *
 * const app = new AixyzApp();
 * await app.withPlugin(new A2APlugin([{ exports: agent }]));
 * await app.withPlugin(new MCPPlugin([{ name: "myTool", exports: myTool }]));
 * await app.initialize();
 *
 * const server = express();
 *
 * // Your own Express routes
 * server.get("/health", (_req, res) => res.json({ status: "ok" }));
 *
 * // Mount AixyzApp (handles /agent, /mcp, /.well-known/agent-card.json, etc.)
 * server.use(toExpressMiddleware(app));
 *
 * server.listen(3000);
 * ```
 */
export function toExpressMiddleware(app: AixyzApp) {
  return async (req: NodeRequest, res: NodeResponse, next: (err?: unknown) => void) => {
    try {
      const request = toWebRequest(req);
      const response = await app.fetch(request);

      // Let Express handle unmatched routes
      if (response.status === 404) {
        return next();
      }

      await writeResponse(response, res);
    } catch (err) {
      next(err);
    }
  };
}

function toWebRequest(req: NodeRequest): Request {
  const protocol = (req.headers["x-forwarded-proto"] as string) || "http";
  const host = req.headers.host || "localhost";
  const url = `${protocol}://${host}${req.url || "/"}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const method = (req.method || "GET").toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  return new Request(url, {
    method,
    headers,
    body: hasBody ? (req as unknown as ReadableStream) : undefined,
    // @ts-expect-error -- Node 18+ supports duplex on RequestInit
    duplex: hasBody ? "half" : undefined,
  });
}

async function writeResponse(response: Response, res: NodeResponse): Promise<void> {
  res.writeHead(response.status, Object.fromEntries(response.headers));

  if (!response.body) {
    res.end();
    return;
  }

  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } finally {
    reader.releaseLock();
    res.end();
  }
}
