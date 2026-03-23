import type { AixyzConfig } from "@aixyz/config";

/**
 * MPP payment gateway for aixyz.
 *
 * Wraps `mppx/server` to provide an MPP-compatible payment gate.
 * Handles the HTTP 402 Challenge/Credential flow using the
 * WWW-Authenticate: Payment and Authorization: Payment headers.
 *
 * Protocol: https://mpp.dev
 */
export class MppPaymentGateway {
  private mppx: any; // mppx/server Mppx instance
  private readonly config: NonNullable<AixyzConfig["mpp"]>;

  constructor(config: NonNullable<AixyzConfig["mpp"]>) {
    this.config = config;
  }

  /**
   * Initialize the MPP payment gateway.
   * Dynamically imports mppx/server and builds payment methods from config.
   */
  async initialize(): Promise<void> {
    // Dynamic import so mppx remains an optional peer dependency.
    // If mpp is configured but mppx isn't installed, throw a clear error.
    let mppxServer: any;
    try {
      mppxServer = await import("mppx/server");
    } catch {
      throw new Error(
        "[aixyz] MPP is configured but `mppx` is not installed. Run: bun add mppx",
      );
    }

    const { Mppx, tempo, stripe, lightning } = mppxServer;

    const methods: any[] = [];

    for (const method of this.config.methods ?? ["tempo"]) {
      switch (method) {
        case "tempo": {
          const feePayerKey = this.config.feePayerKey ?? process.env.MPP_FEE_PAYER_KEY;
          methods.push(
            tempo({
              currency: this.config.currency ?? process.env.MPP_CURRENCY ?? "0x20c0000000000000000000000000000000000000",
              recipient: this.config.recipient ?? process.env.MPP_RECIPIENT,
              waitForConfirmation: !(this.config.optimistic ?? false),
              ...(feePayerKey ? { feePayer: feePayerKey } : {}),
            }),
          );
          break;
        }
        case "stripe": {
          const stripeKey = this.config.stripeSecretKey ?? process.env.MPP_STRIPE_SECRET_KEY;
          if (!stripeKey) {
            throw new Error(
              "[aixyz] MPP Stripe method requires a secret key. Set `mpp.stripeSecretKey` or `MPP_STRIPE_SECRET_KEY`.",
            );
          }
          methods.push(stripe({ secretKey: stripeKey }));
          break;
        }
        case "lightning": {
          methods.push(lightning());
          break;
        }
      }
    }

    this.mppx = Mppx.create({ methods });
  }

  /**
   * Verify MPP payment for a request.
   *
   * Returns a 402 Response (with WWW-Authenticate: Payment challenge) if payment
   * is required or invalid, or null if the request is authorized to proceed.
   */
  async verify(request: Request, amount: string): Promise<Response | null> {
    if (!this.mppx) {
      throw new Error("MppPaymentGateway not initialized. Call initialize() first.");
    }

    // Check if an Authorization: Payment credential is present
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Payment ")) {
      // Credential present — let mppx verify it
      const result = await this.mppx.charge({ amount })(request);
      if (result.status === 402) {
        // Verification failed (bad credential)
        return result;
      }
      // Store receipt for later attachment
      this._pendingReceipts.set(request, result.headers.get("Payment-Receipt") ?? "");
      return null;
    }

    // No credential — issue the 402 challenge
    const result = await this.mppx.charge({ amount })(request);
    if (result.status === 402) {
      return result;
    }

    return null;
  }

  private _pendingReceipts = new WeakMap<Request, string>();

  /**
   * Returns the Payment-Receipt header value for a previously verified request,
   * if one was produced by the MPP server. Returns null if not available.
   */
  getReceipt(request: Request): string | null {
    return this._pendingReceipts.get(request) ?? null;
  }
}
