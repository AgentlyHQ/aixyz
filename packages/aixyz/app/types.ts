import type { Accepts, AcceptsX402, AcceptsX402Multi } from "../accepts";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";

export type RouteHandler = (request: Request) => Response | Promise<Response>;

export type Middleware = (request: Request, next: () => Promise<Response>) => Response | Promise<Response>;

export interface RouteOptions {
  payment?: Accepts;
}

export interface RouteEntry {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
  payment?: AcceptsX402 | AcceptsX402Multi;
}
