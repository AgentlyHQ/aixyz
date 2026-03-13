import type { IncomingMessage } from "node:http";
import { createDispatcher } from "../dispatcher";
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

export function toExpress(app: AixyzApp) {
  const dispatch = createDispatcher(app);

  return async (req: NodeRequest, res: NodeResponse, next: (err?: unknown) => void) => {
    const request = toWebRequest(req);
    const response = await dispatch(request);

    // Let Express handle unmatched routes
    if (response.status === 404) {
      return next();
    }

    await writeResponse(response, res);
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
