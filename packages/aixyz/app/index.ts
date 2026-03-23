import type { AcceptsX402 } from "../accepts";
import type { FacilitatorClient } from "@x402/core/server";
import { type HttpMethod, type RouteHandler, type Middleware, type RouteEntry, type RoutePaymentOptions } from "./types";
import { PaymentGateway } from "./payment/payment";
import { MppPaymentGateway } from "./payment/mpp";
import { Network } from "@x402/core/types";
import { getAixyzConfig } from "@aixyz/config";
import { loadEnvConfig } from "@next/env";
import { BasePlugin } from "./plugin";

// Load .env and .env.production files at runtime (local files are excluded at build time).
loadEnvConfig(process.cwd());

export { BasePlugin };
export type { HttpMethod, RouteHandler, Middleware, RouteEntry };

export interface AixyzAppOptions {
  facilitators?: FacilitatorClient | FacilitatorClient[];
}

/**
 * Framework-agnostic route and middleware registry with optional payment gating.
 *
 * Supports two payment protocols, independently or simultaneously:
 * - **x402**: HTTP 402 with `X-Payment` headers (EVM/Base, existing behavior)
 * - **MPP**: HTTP 402 with `WWW-Authenticate: Payment` headers (Tempo, Stripe, Lightning)
 *
 * Which protocols are active is determined by what's configured in `aixyz.config.ts`:
 * - Only `x402` → x402 only
 * - Only `mpp`  → MPP only
 * - Both        → both; dispatched based on incoming request headers
 *
 * Call `fetch()` to dispatch a web-standard Request through payment verification,
 * middleware, and route handler.
 */
export class AixyzApp {
  readonly routes = new Map<string, RouteEntry>();
  readonly payment?: PaymentGateway;
  readonly mppPayment?: MppPaymentGateway;
  private middlewares: Middleware[] = [];
  private plugins: BasePlugin[] = [];
  private readonly poweredByHeader: boolean;

  constructor(options?: AixyzAppOptions) {
    const config = getAixyzConfig();
    this.poweredByHeader = config.build.poweredByHeader;

    // Initialize x402 gateway if configured
    if (config.x402) {
      const facilitators = options?.facilitators;
      if (facilitators) {
        this.payment = new PaymentGateway(facilitators, config as any);
        this.payment.register((config.x402.network as Network) ?? "eip155:8453");
      }
    }

    // Initialize MPP gateway if configured
    if (config.mpp) {
      this.mppPayment = new MppPaymentGateway(config.mpp);
    }
  }

  /** Initialize payment gateways and plugins. Must be called after all routes are registered. */
  async initialize(): Promise<void> {
    if (this.payment) {
      for (const [, entry] of this.routes) {
        if (entry.payment?.x402) {
          this.payment.addRoute(entry.method, entry.path, entry.payment.x402);
        }
      }
      await this.payment.initialize();
    }

    if (this.mppPayment) {
      await this.mppPayment.initialize();
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

  /**
   * Register a route with optional payment requirements.
   *
   * @example
   * // x402 only
   * app.route("POST", "/agent", handler, { payment: { x402: { scheme: "exact", price: "$0.005" } } });
   *
   * @example
   * // MPP only
   * app.route("POST", "/agent", handler, { payment: { mppAmount: "0.005" } });
   *
   * @example
   * // Both (when both x402 and mpp are configured)
   * app.route("POST", "/agent", handler, { payment: { x402: { scheme: "exact", price: "$0.005" }, mppAmount: "0.005" } });
   */
  route(method: HttpMethod, path: string, handler: RouteHandler, options?: { payment?: RoutePaymentOptions }): void {
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

    if (entry.payment) {
      const paymentResponse = await this.verifyPayment(request, entry.payment);
      if (paymentResponse) return paymentResponse;
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

    if (entry.payment) {
      return this.attachPaymentReceipts(request, response, entry.payment);
    }

    return response;
  };

  /**
   * Verify payment for a request against the configured protocol(s).
   *
   * When both x402 and mpp are configured:
   * - `Authorization: Payment ...` → MPP path
   * - `X-Payment: ...` / `PAYMENT-SIGNATURE: ...` → x402 path
   * - Neither → return 402 with challenge(s) for all active protocols
   */
  private async verifyPayment(request: Request, payment: RoutePaymentOptions): Promise<Response | null> {
    const hasMppCredential = request.headers.get("Authorization")?.startsWith("Payment ");
    const hasX402Credential =
      request.headers.has("X-Payment") || request.headers.has("PAYMENT-SIGNATURE");

    const bothConfigured = this.payment && payment.x402 && this.mppPayment && payment.mppAmount;

    if (bothConfigured) {
      if (hasMppCredential) {
        // Client is speaking MPP
        return this.mppPayment!.verify(request, payment.mppAmount!);
      }
      if (hasX402Credential) {
        // Client is speaking x402
        return this.payment!.verify(request);
      }
      // No credential — return a combined 402 with both challenges
      return this.buildCombined402(request, payment);
    }

    // Only MPP configured
    if (this.mppPayment && payment.mppAmount) {
      return this.mppPayment.verify(request, payment.mppAmount);
    }

    // Only x402 configured (original behavior)
    if (this.payment && payment.x402) {
      return this.payment.verify(request);
    }

    return null;
  }

  /**
   * Build a 402 response that includes challenge headers for all active payment protocols.
   * Clients that speak either protocol will be able to proceed.
   */
  private async buildCombined402(request: Request, payment: RoutePaymentOptions): Promise<Response> {
    const headers = new Headers();
    headers.set("Content-Type", "application/json");

    // Get the MPP 402 challenge (WWW-Authenticate: Payment ...)
    if (this.mppPayment && payment.mppAmount) {
      const mppChallenge = await this.mppPayment.verify(request, payment.mppAmount);
      if (mppChallenge?.status === 402) {
        const wwwAuth = mppChallenge.headers.get("WWW-Authenticate");
        if (wwwAuth) headers.set("WWW-Authenticate", wwwAuth);
      }
    }

    // Get the x402 402 challenge (X-Payment-Required: ...)
    if (this.payment && payment.x402) {
      const x402Challenge = await this.payment.verify(request);
      if (x402Challenge?.status === 402) {
        for (const [key, value] of x402Challenge.headers.entries()) {
          if (key.toLowerCase().startsWith("x-payment")) {
            headers.set(key, value);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ error: "Payment Required", protocols: ["mpp", "x402"] }),
      { status: 402, headers },
    );
  }

  /**
   * Attach payment receipt headers to a successful response.
   */
  private async attachPaymentReceipts(
    request: Request,
    response: Response,
    payment: RoutePaymentOptions,
  ): Promise<Response> {
    const cloned = new Response(response.body, response);

    // Attach MPP receipt if present
    if (this.mppPayment) {
      const receipt = this.mppPayment.getReceipt(request);
      if (receipt) {
        cloned.headers.set("Payment-Receipt", receipt);
      }
    }

    // Attach x402 settlement header if present
    if (this.payment && payment.x402) {
      const settlementResult = await this.payment.settle(request);
      if (settlementResult?.success) {
        const paymentResultHeader = settlementResult.headers["PAYMENT-RESPONSE"];
        cloned.headers.set("PAYMENT-RESPONSE", paymentResultHeader);
      }
    }

    return cloned;
  }
}
