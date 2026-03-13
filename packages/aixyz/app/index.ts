import type { AcceptsX402 } from "../accepts";
import type { FacilitatorClient } from "@x402/core/server";
import { type HttpMethod, type RouteHandler, type Middleware, type RouteEntry, BASE_NETWORK } from "./types";
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
 * Does not handle HTTP dispatch — use an adapter (e.g. `toFetch`, `toExpress`) for that.
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
      this.payment.register((config.x402.network as Network) ?? BASE_NETWORK);
    }
  }

  /** Initialize payment gateway. Must be called after all routes are registered. */
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
}
