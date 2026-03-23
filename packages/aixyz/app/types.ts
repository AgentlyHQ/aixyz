import type { AcceptsX402 } from "../accepts";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";

export type RouteHandler = (request: Request) => Response | Promise<Response>;

export type Middleware = (request: Request, next: () => Promise<Response>) => Response | Promise<Response>;

export interface RoutePaymentOptions {
  /**
   * x402 payment requirement for this route.
   * Used when `x402` is configured in `aixyz.config.ts`.
   */
  x402?: AcceptsX402;
  /**
   * MPP payment amount for this route (USD string, e.g. "0.005").
   * Used when `mpp` is configured in `aixyz.config.ts`.
   * The payment methods accepted are determined by `mpp.methods` in config.
   */
  mppAmount?: string;
}

export interface RouteEntry {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
  payment?: RoutePaymentOptions;
}
