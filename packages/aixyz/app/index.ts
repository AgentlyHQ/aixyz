import type { AcceptsX402 } from "../accepts";
import type { FacilitatorClient } from "@x402/core/server";
import { type HttpMethod, type RouteHandler, type Middleware, type RouteEntry } from "./types";
import { PaymentGateway } from "./payment/payment";
import { Network } from "@x402/core/types";
import { getAixyzConfig } from "@aixyz/config";
import { BasePlugin } from "./plugin";

export { BasePlugin };
export type { HttpMethod, RouteHandler, Middleware, RouteEntry };

export interface AixyzAppOptions {
  facilitators?: FacilitatorClient | FacilitatorClient[];
}

/**
 * Framework-agnostic route and middleware registry with optional x402 payment gating.
 * Call `fetch()` to dispatch a web-standard Request through payment verification, middleware, and route handler.
 */
export class AixyzApp {
  readonly routes = new Map<string, RouteEntry>();
  readonly payment?: PaymentGateway;
  private middlewares: Middleware[] = [];
  private plugins: BasePlugin[] = [];

  constructor(options?: AixyzAppOptions) {
    if (options?.facilitators) {
      const config = getAixyzConfig();
      this.payment = new PaymentGateway(options.facilitators, config);
      this.payment.register((config.x402.network as Network) ?? "eip155:8453");
    }
  }

  /** Initialize payment gateway and plugins. Must be called after all routes are registered. */
  async initialize(): Promise<void> {
    if (this.payment) {
      // Register payment routes with the gateway before initializing
      for (const [, entry] of this.routes) {
        if (entry.payment) {
          this.payment.addRoute(entry.method, entry.path, entry.payment);
        }
      }
      await this.payment.initialize();
    }

    for (const plugin of this.plugins) {
      await plugin.initialize?.(this);
    }
  }

  /** Register a plugin. Calls plugin.register(this) and returns this for chaining. */
  async withPlugin<B extends BasePlugin>(plugin: B): Promise<this> {
    this.plugins.push(plugin);
    await plugin.register(this);
    return this;
  }

  /** Returns the canonical lookup key for a route (e.g. "POST /agent"). */
  getRouteKey(method: HttpMethod, path: string) {
    return `${method} ${path}`;
  }

  /** Register a route with an optional x402 payment requirement. */
  route(method: HttpMethod, path: string, handler: RouteHandler, options?: { payment?: AcceptsX402 }): void {
    const key = this.getRouteKey(method, path);
    this.routes.set(key, {
      method,
      path,
      handler,
      payment: options?.payment,
    });
  }

  /** Append a middleware to the chain. Middlewares run in registration order before the route handler. */
  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  /** Returns the registered middlewares (read-only access for adapters). */
  getMiddlewares(): Middleware[] {
    return this.middlewares;
  }

  /** Dispatch a web-standard Request through payment verification, middleware, and route handler. */
  fetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const key = this.getRouteKey(request.method as HttpMethod, url.pathname);
    const entry = this.routes.get(key);

    if (!entry) {
      return new Response("Not Found", { status: 404 });
    }

    if (entry.payment && this.payment) {
      const rejection = await this.payment.verify(request);
      if (rejection) return rejection;
    }

    let index = 0;
    const middlewares = this.middlewares;
    const handler = entry.handler;

    const next = async (): Promise<Response> => {
      if (index < middlewares.length) {
        const mw = middlewares[index++];
        return mw(request, next);
      }
      return handler(request);
    };

    const response = await next();

    if (entry.payment && this.payment) {
      const settlementResult = await this.payment.settle(request);
      if (settlementResult?.success) {
        const paymentResultHeader = settlementResult.headers["PAYMENT-RESPONSE"];
        const cloned = new Response(response.body, response);
        cloned.headers.set("PAYMENT-RESPONSE", paymentResultHeader);
        return cloned;
      }
    }

    return response;
  };
}
