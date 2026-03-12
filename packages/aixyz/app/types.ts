import { Network } from "@x402/core/types";
import type { AcceptsX402 } from "../accepts";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";

export type RouteHandler = (request: Request) => Response | Promise<Response>;

export type Middleware = (request: Request, next: () => Promise<Response>) => Response | Promise<Response>;

export interface RouteEntry {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
  payment?: AcceptsX402;
}

export const BASE_NETWORK: Network = "eip155:8453";
