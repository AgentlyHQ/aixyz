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
    // Check Stripe availability at runtime (handles Vercel cold start timing)
    const isStripeEnabled = () => config.stripe.enabled && !!process.env.STRIPE_SECRET_KEY;

    // 1. Check for Stripe PaymentIntent ID first
    if (isStripeEnabled()) {
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

      // 2. Intercept 402 responses to add Stripe options
      // Helper to augment 402 response body with Stripe options
      const augment402Body = (body: unknown): unknown => {
        if (res.statusCode === 402 && typeof body === "object" && body !== null) {
          const bodyObj = body as Record<string, unknown>;
          const existingOptions = typeof bodyObj.paymentOptions === "object" ? bodyObj.paymentOptions : {};
          return {
            ...bodyObj,
            paymentOptions: {
              ...existingOptions,
              stripe: getStripeOptions(config),
            },
          };
        }
        return body;
      };

      // Intercept res.json()
      const originalJson = res.json.bind(res);
      res.json = (body: unknown) => originalJson(augment402Body(body));

      // Intercept res.send() - x402 middleware may use this instead of res.json()
      const originalSend = res.send.bind(res);
      res.send = (body: unknown) => {
        if (res.statusCode === 402 && typeof body === "string") {
          try {
            const parsed = JSON.parse(body);
            return originalSend(JSON.stringify(augment402Body(parsed)));
          } catch {
            // Not JSON, pass through
          }
        }
        return originalSend(body);
      };
    }

    // 3. Fall through to x402 middleware with error handling
    try {
      await x402Middleware(req, res, next);
    } catch (error) {
      console.error("[x402] Runtime error:", error);

      // Response already sent, nothing we can do
      if (res.headersSent) return;

      // Offer both payment options as fallback
      if (isStripeEnabled()) {
        return res.status(402).json({
          error: "Payment Required",
          message: "Crypto payment temporarily unavailable",
          options: getPaymentOptions(config),
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

  // Check Stripe availability at runtime (handles Vercel cold start timing)
  if (config.stripe.enabled && !!process.env.STRIPE_SECRET_KEY) {
    options.stripe = getStripeOptions(config);
  }

  return options;
}
