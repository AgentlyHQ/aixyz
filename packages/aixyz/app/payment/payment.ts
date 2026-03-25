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
import type { AcceptsX402 } from "../../accepts";
import { Network, PaymentPayload, PaymentRequirements, VerifyResponse, SettleResponse } from "@x402/core/types";
import { AixyzConfig } from "@aixyz/config";

// ── x402 Lifecycle Hook Types ──────────────────────────────────────────
// These mirror x402ResourceServer's hook signatures but are defined here
// because x402/core does not export them publicly.

export interface VerifyContext {
  paymentPayload: PaymentPayload;
  requirements: PaymentRequirements;
}

export interface VerifyResultContext extends VerifyContext {
  result: VerifyResponse;
}

export interface VerifyFailureContext extends VerifyContext {
  error: Error;
}

export interface SettleContext {
  paymentPayload: PaymentPayload;
  requirements: PaymentRequirements;
}

export interface SettleResultContext extends SettleContext {
  result: SettleResponse;
}

export interface SettleFailureContext extends SettleContext {
  error: Error;
}

export type BeforeVerifyHook = (
  context: VerifyContext,
) => Promise<void | { abort: true; reason: string; message?: string }>;
export type AfterVerifyHook = (context: VerifyResultContext) => Promise<void>;
export type OnVerifyFailureHook = (
  context: VerifyFailureContext,
) => Promise<void | { recovered: true; result: VerifyResponse }>;
export type BeforeSettleHook = (
  context: SettleContext,
) => Promise<void | { abort: true; reason: string; message?: string }>;
export type AfterSettleHook = (context: SettleResultContext) => Promise<void>;
export type OnSettleFailureHook = (
  context: SettleFailureContext,
) => Promise<void | { recovered: true; result: SettleResponse }>;

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
    this.onAfterVerify(async (context) => {
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

  // ── x402 Lifecycle Hooks ───────────────────────────────────────────

  /** Register a hook to run before payment verification. Return `{ abort: true, reason }` to reject. */
  onBeforeVerify(hook: BeforeVerifyHook): this {
    this.resourceServer.onBeforeVerify(hook);
    return this;
  }

  /** Register a hook to run after successful payment verification. */
  onAfterVerify(hook: AfterVerifyHook): this {
    this.resourceServer.onAfterVerify(hook);
    return this;
  }

  /** Register a hook to run when payment verification fails. Return `{ recovered: true, result }` to recover. */
  onVerifyFailure(hook: OnVerifyFailureHook): this {
    this.resourceServer.onVerifyFailure(hook);
    return this;
  }

  /** Register a hook to run before payment settlement. Return `{ abort: true, reason }` to reject. */
  onBeforeSettle(hook: BeforeSettleHook): this {
    this.resourceServer.onBeforeSettle(hook);
    return this;
  }

  /** Register a hook to run after successful payment settlement. */
  onAfterSettle(hook: AfterSettleHook): this {
    this.resourceServer.onAfterSettle(hook);
    return this;
  }

  /** Register a hook to run when payment settlement fails. Return `{ recovered: true, result }` to recover. */
  onSettleFailure(hook: OnSettleFailureHook): this {
    this.resourceServer.onSettleFailure(hook);
    return this;
  }
}
