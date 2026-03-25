import { FacilitatorClient, ProcessSettleResultResponse, x402ResourceServer } from "@x402/core/server";
import {
  x402HTTPResourceServer,
  type HTTPAdapter,
  type HTTPRequestContext,
  type RoutesConfig,
  type RouteConfig,
  type HTTPResponseInstructions,
} from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { AcceptsX402, AcceptsX402Multi } from "../../accepts";
import { normalizeAcceptsX402 } from "../../accepts";
import { Network, PaymentPayload, PaymentRequirements } from "@x402/core/types";
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
  let body: string | undefined;
  if (instructions.body != null) {
    body = instructions.isHtml ? String(instructions.body) : JSON.stringify(instructions.body);
  }
  if (body && !headers.has("content-type")) {
    headers.set("content-type", instructions.isHtml ? "text/html" : "application/json");
  }
  return new Response(body, { status: instructions.status, headers });
}

export interface PaymentContext {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
  declaredExtensions?: Record<string, unknown>;
  /** The payer's address, captured from x402 verification. */
  payer?: string;
}

/**
 * Thin wrapper around x402HTTPResourceServer
 */
export class PaymentGateway {
  readonly resourceServer: x402ResourceServer;
  private httpServer?: x402HTTPResourceServer;
  private readonly config: AixyzConfig;
  private readonly pendingRoutes = new Map<string, RouteConfig>();
  private readonly verifiedPayments = new WeakMap<Request, PaymentContext>();
  /**
   * Temporary map to capture payer address from the afterVerify hook.
   * Keyed by PaymentPayload reference (same object flows through the verify pipeline).
   */
  private readonly pendingPayers = new WeakMap<PaymentPayload, string>();

  constructor(facilitators: FacilitatorClient | FacilitatorClient[], config: AixyzConfig) {
    this.resourceServer = new x402ResourceServer(facilitators);
    this.config = config;

    // Capture payer address from verification so it can be exposed to handlers.
    this.resourceServer.onAfterVerify(async (context) => {
      if (context.result.payer) {
        this.pendingPayers.set(context.paymentPayload, context.result.payer);
      }
    });
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
  addRoute(method: string, path: string, accepts: AcceptsX402 | AcceptsX402Multi): void {
    const pattern = this.getRouteKey(method, path);
    const items = normalizeAcceptsX402(accepts);
    this.pendingRoutes.set(pattern, {
      accepts: items.map((a) => ({
        scheme: a.scheme,
        payTo: a.payTo ?? this.config.x402.payTo,
        price: a.price,
        network: (a.network as Network) ?? (this.config.x402.network as Network),
      })),
    });
  }

  /**
   * Initialize the payment gateway. Registers all required network schemes
   * from pending routes, then builds the x402HTTPResourceServer.
   * Must be called after all routes are added.
   */
  async initialize(): Promise<void> {
    this.registerNetworksFromRoutes();
    const routes: RoutesConfig =
      this.pendingRoutes.size > 0 ? Object.fromEntries(this.pendingRoutes) : { "* /*": { accepts: [] } };
    this.httpServer = new x402HTTPResourceServer(this.resourceServer, routes);
    await this.httpServer.initialize();
  }

  private registerNetworksFromRoutes(): void {
    const networks = new Set<Network>();
    const defaultNetwork = (this.config.x402.network as Network) ?? ("eip155:8453" as Network);
    networks.add(defaultNetwork);

    for (const [, route] of this.pendingRoutes) {
      const accepts = Array.isArray(route.accepts) ? route.accepts : [route.accepts];
      for (const opt of accepts) {
        if (opt.network) networks.add(opt.network as Network);
      }
    }

    for (const network of networks) {
      this.register(network);
    }
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

      case "payment-verified": {
        const payer = this.pendingPayers.get(result.paymentPayload);
        this.verifiedPayments.set(request, {
          paymentPayload: result.paymentPayload,
          paymentRequirements: result.paymentRequirements,
          declaredExtensions: result.declaredExtensions,
          payer,
        });
        return null;
      }

      case "payment-error":
        return toResponse(result.response);
    }
  }

  /**
   * Settle a previously verified payment. Call after the handler responds successfully.
   * Returns settlement headers to merge into the response, or null if nothing to settle.
   */
  async settle(request: Request): Promise<ProcessSettleResultResponse | null> {
    const ctx = this.verifiedPayments.get(request);
    if (!ctx || !this.httpServer) return null;
    this.verifiedPayments.delete(request);

    const result = await this.httpServer.processSettlement(
      ctx.paymentPayload,
      ctx.paymentRequirements,
      ctx.declaredExtensions,
    );

    return result;
  }

  /**
   * Get the payer's address for a verified payment request.
   * Available after `verify()` succeeds and before `settle()` is called.
   */
  getPayer(request: Request): string | undefined {
    return this.verifiedPayments.get(request)?.payer;
  }

  /**
   * Get the full payment context for a verified payment request.
   * Available after `verify()` succeeds and before `settle()` is called.
   */
  getPaymentContext(request: Request): Readonly<PaymentContext> | undefined {
    return this.verifiedPayments.get(request);
  }
}
