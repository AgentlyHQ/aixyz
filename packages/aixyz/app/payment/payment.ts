import { FacilitatorClient, x402ResourceServer } from "@x402/core/server";
import {
  x402HTTPResourceServer,
  type HTTPAdapter,
  type HTTPRequestContext,
  type RoutesConfig,
  type RouteConfig,
  type HTTPResponseInstructions,
} from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { AcceptsX402 } from "../../accepts";
import { Network } from "@x402/core/types";
import { AixyzConfig } from "@aixyz/config";

/**
 * Converts a web-standard Request into the x402 HTTPAdapter interface.
 */
function toHTTPAdapter(request: Request): HTTPAdapter {
  const url = new URL(request.url);
  return {
    getHeader: (name) => request.headers.get(name) ?? undefined,
    getMethod: () => request.method,
    getPath: () => url.pathname,
    getUrl: () => request.url,
    getAcceptHeader: () => request.headers.get("accept") ?? "",
    getUserAgent: () => request.headers.get("user-agent") ?? "",
    getQueryParams: () => Object.fromEntries(url.searchParams),
    getQueryParam: (name) => url.searchParams.get(name) ?? undefined,
  };
}

/**
 * Converts x402 HTTPResponseInstructions into a web-standard Response.
 */
function toResponse(instructions: HTTPResponseInstructions): Response {
  const headers = new Headers(instructions.headers);
  const body = instructions.body != null ? JSON.stringify(instructions.body) : undefined;
  if (body && !headers.has("content-type") && !instructions.isHtml) {
    headers.set("content-type", "application/json");
  }
  if (instructions.isHtml && body) {
    headers.set("content-type", "text/html");
  }
  return new Response(body, { status: instructions.status, headers });
}

/**
 * Thin wrapper around x402HTTPResourceServer
 */
export class PaymentGateway {
  private readonly resourceServer: x402ResourceServer;
  private httpServer?: x402HTTPResourceServer;
  private readonly config: AixyzConfig;
  private readonly pendingRoutes = new Map<string, RouteConfig>();

  constructor(facilitators: FacilitatorClient | FacilitatorClient[], config: AixyzConfig) {
    this.resourceServer = new x402ResourceServer(facilitators);
    this.config = config;
  }

  /** Register an EVM payment scheme for the given network (e.g. Base mainnet). */
  register(network: Network) {
    this.resourceServer.register(network, new ExactEvmScheme());
  }

  /** Returns the canonical lookup key for a payment route (e.g. "POST /agent"). */
  getRouteKey(method: string, path: string) {
    return `${method.toUpperCase()} ${path}`;
  }

  /**
   * Add a payment-gated route. Must be called before initialize().
   */
  addRoute(method: string, path: string, accepts: AcceptsX402): void {
    const pattern = this.getRouteKey(method, path);
    this.pendingRoutes.set(pattern, {
      accepts: {
        scheme: accepts.scheme,
        payTo: accepts.payTo ?? this.config.x402.payTo,
        price: accepts.price,
        network: (accepts.network as Network) ?? (this.config.x402.network as Network),
      },
    });
  }

  /**
   * Initialize the payment gateway. Builds the x402HTTPResourceServer from registered routes.
   * Must be called after all routes are added.
   */
  async initialize(): Promise<void> {
    const routes: RoutesConfig =
      this.pendingRoutes.size > 0 ? Object.fromEntries(this.pendingRoutes) : { "* /*": { accepts: [] } };
    this.httpServer = new x402HTTPResourceServer(this.resourceServer, routes);
    await this.httpServer.initialize();
  }

  /**
   * Verify payment for a request. Returns a 402 Response if payment is required/invalid,
   * or null if the request is authorized to proceed.
   */
  async verify(request: Request): Promise<Response | null> {
    if (!this.httpServer) {
      throw new Error("PaymentGateway not initialized. Call initialize() first.");
    }

    const adapter = toHTTPAdapter(request);
    const context: HTTPRequestContext = {
      adapter,
      path: adapter.getPath(),
      method: adapter.getMethod(),
      paymentHeader: adapter.getHeader("payment-signature") || adapter.getHeader("PAYMENT-SIGNATURE"),
    };

    const result = await this.httpServer.processHTTPRequest(context);

    switch (result.type) {
      case "no-payment-required":
        return null;

      case "payment-verified":
        // Settlement happens after the handler responds successfully
        // Store payment info for later settlement
        return null;

      case "payment-error":
        return toResponse(result.response);
    }
  }
}
