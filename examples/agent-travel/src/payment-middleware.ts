import type { Request, Response, NextFunction, RequestHandler } from "express";
import { paymentMiddleware } from "@x402/express";
import { validateAndConsumePaymentIntent } from "./stripe";

export interface UnifiedPaymentConfig {
  x402: {
    routes: Record<string, unknown>;
    resourceServer: unknown;
  };
  stripe: {
    enabled: boolean;
    priceInCents: number;
  };
}

export function unifiedPaymentMiddleware(config: UnifiedPaymentConfig): RequestHandler {
  const x402Middleware = paymentMiddleware(
    config.x402.routes as Parameters<typeof paymentMiddleware>[0],
    config.x402.resourceServer as Parameters<typeof paymentMiddleware>[1],
  );

  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. Check for Stripe PaymentIntent ID first
    if (config.stripe.enabled) {
      const stripePaymentIntentId = req.headers["x-stripe-payment-intent-id"] as string;
      if (stripePaymentIntentId) {
        const result = await validateAndConsumePaymentIntent(stripePaymentIntentId, config.stripe.priceInCents);
        if (result.valid) {
          return next();
        }
        return res.status(402).json({
          error: "Payment Required",
          message: result.error,
          options: getPaymentOptions(config),
        });
      }
    }

    // 2. Fall through to x402 middleware with error handling
    try {
      await x402Middleware(req, res, next);
    } catch (error) {
      console.error("[x402] Runtime error:", error);

      // Response already sent, nothing we can do
      if (res.headersSent) return;

      // Offer Stripe as fallback if available
      if (config.stripe.enabled) {
        return res.status(402).json({
          error: "Payment Required",
          message: "Crypto payment temporarily unavailable",
          options: {
            stripe: getStripeOptions(config),
          },
        });
      }

      return res.status(503).json({ error: "Payment service unavailable" });
    }
  };
}

function getStripeOptions(config: UnifiedPaymentConfig) {
  return {
    description: "Pay with credit card via Stripe",
    header: "X-Stripe-Payment-Intent-Id",
    price: `$${(config.stripe.priceInCents / 100).toFixed(2)}`,
  };
}

function getPaymentOptions(config: UnifiedPaymentConfig) {
  const options: Record<string, unknown> = {
    x402: {
      description: "Pay with cryptocurrency (USDC on Base)",
      headers: ["X-Payment", "X-402-Payment"],
    },
  };

  if (config.stripe.enabled) {
    options.stripe = getStripeOptions(config);
  }

  return options;
}
