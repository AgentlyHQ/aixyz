import { isAcceptsPaid, AcceptsScheme } from "../accepts";
import type { Accepts } from "../accepts";
import type { FacilitatorClient } from "@x402/core/server";
import { type HttpMethod, type RouteHandler, type Middleware, type RouteEntry, type RouteOptions } from "./types";
import { PaymentGateway } from "./payment/payment";
import { getAixyzConfig } from "@aixyz/config";
import { loadEnvConfig } from "@next/env";
import { BasePlugin, type RegisterContext, type InitializeContext, type PaymentHookContext } from "./plugin";

// Load .env and .env.production files at runtime (local files are excluded at build time).
loadEnvConfig(process.cwd());

export { BasePlugin };
export type { RegisterContext, InitializeContext };
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
  private readonly poweredByHeader: boolean;

  constructor(options?: AixyzAppOptions) {
    // TODO(future): getAiXyzConfig will be materialized.
    //  this is internal, we control it so it's fine for us to use—but we changing it in the future.
    const config = getAixyzConfig();
    this.poweredByHeader = config.build.poweredByHeader;

    if (options?.facilitators) {
      this.payment = new PaymentGateway(options.facilitators, config);
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

    const ctx: InitializeContext = {
      routes: this.routes,
      getPlugin: <T extends BasePlugin>(name: string) => this.getPlugin<T>(name),
      payment: this.payment,
    };
    for (const plugin of this.plugins) {
      await plugin.initialize?.(ctx);
    }
  }

  /** Register a plugin with a scoped RegisterContext that auto-tracks registered routes. */
  async withPlugin<B extends BasePlugin>(plugin: B): Promise<this> {
    this.plugins.push(plugin);
    // clear registered routes for this plugin before registration, in case of hot reload or multiple registrations
    plugin.registeredRoutes.clear();

    const paymentHooks: PaymentHookContext | undefined = this.payment
      ? {
          onBeforeVerify: (h) => {
            this.payment!.onBeforeVerify(h);
            return paymentHooks!;
          },
          onAfterVerify: (h) => {
            this.payment!.onAfterVerify(h);
            return paymentHooks!;
          },
          onVerifyFailure: (h) => {
            this.payment!.onVerifyFailure(h);
            return paymentHooks!;
          },
          onBeforeSettle: (h) => {
            this.payment!.onBeforeSettle(h);
            return paymentHooks!;
          },
          onAfterSettle: (h) => {
            this.payment!.onAfterSettle(h);
            return paymentHooks!;
          },
          onSettleFailure: (h) => {
            this.payment!.onSettleFailure(h);
            return paymentHooks!;
          },
        }
      : undefined;

    const ctx: RegisterContext = {
      route: (method, path, handler, options) => {
        this.route(method, path, handler, options);
        const key = this.getRouteKey(method, path);
        const entry = this.routes.get(key);
        if (entry) plugin.registeredRoutes.set(key, entry);
      },
      use: (mw) => this.use(mw),
      paymentHooks,
    };
    await plugin.register?.(ctx);
    return this;
  }

  /** Returns the canonical lookup key for a route (e.g. "POST /agent"). */
  getRouteKey(method: HttpMethod, path: string) {
    return `${method} ${path}`;
  }

  /** Register a route with an optional x402 payment requirement. Free accepts are filtered out. */
  route(method: HttpMethod, path: string, handler: RouteHandler, options?: RouteOptions): void {
    const key = this.getRouteKey(method, path);
    if (options?.payment) {
      const result = AcceptsScheme.safeParse(options.payment);
      if (!result.success) {
        throw new Error(`Invalid accepts config for route "${method} ${path}": ${result.error.message}`);
      }
    }
    const payment = options?.payment && isAcceptsPaid(options.payment) ? options.payment : undefined;
    this.routes.set(key, {
      method,
      path,
      handler,
      payment,
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

  /** Find a registered plugin by name. Returns a read-only reference. */
  getPlugin<T extends BasePlugin>(name: string): Readonly<T> | undefined {
    return this.plugins.find((p) => p.name === name) as Readonly<T> | undefined;
  }

  /** Dispatch a web-standard Request through payment verification, middleware, and route handler. */
  fetch = async (request: Request): Promise<Response> => {
    const response = await this.dispatch(request);
    if (this.poweredByHeader) {
      response.headers.set("X-Powered-By", "aixyz");
    }
    return response;
  };

  private dispatch = async (request: Request): Promise<Response> => {
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
