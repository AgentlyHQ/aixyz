import type { RequestHandler } from "express";
import express from "express";
import type { AixyzServer } from "../index";

export type StripeConfig = {
  enabled: boolean;
  priceInCents: number;
  secretKey?: string;
};

let stripe: any = null;

function initializeStripe(secretKey: string): void {
  if (stripe) return;

  try {
    // Dynamically import Stripe to avoid requiring it as a dependency
    const Stripe = require("stripe");
    stripe = new Stripe(secretKey, {
      apiVersion: "2026-01-28.clover" as any,
    });
    console.log("[Stripe] Initialized successfully");
  } catch (error) {
    console.warn("[Stripe] Failed to initialize:", error instanceof Error ? error.message : error);
    stripe = null;
  }
}

async function createPaymentIntent(options: { priceInCents: number }): Promise<{
  clientSecret: string;
  paymentIntentId: string;
}> {
  if (!stripe) throw new Error("Stripe not configured");

  const paymentIntent = await stripe.paymentIntents.create({
    amount: options.priceInCents,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    metadata: {
      consumed: "false",
      expected_amount: String(options.priceInCents),
    },
  });

  console.log(`[Stripe] Created PaymentIntent: ${paymentIntent.id}`);
  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
  };
}

async function validateAndConsumePaymentIntent(
  paymentIntentId: string,
  expectedAmountCents: number,
): Promise<{
  valid: boolean;
  error?: string;
}> {
  if (!stripe) return { valid: false, error: "Stripe not configured" };

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return { valid: false, error: "Payment not completed" };
    }

    if (paymentIntent.amount < expectedAmountCents) {
      console.log(`[Stripe] Amount mismatch: got ${paymentIntent.amount}, expected ${expectedAmountCents}`);
      return { valid: false, error: "Invalid payment amount" };
    }

    if (!paymentIntent.metadata.expected_amount) {
      console.log(`[Stripe] PaymentIntent missing expected_amount metadata: ${paymentIntentId}`);
      return { valid: false, error: "Invalid payment source" };
    }

    if (paymentIntent.metadata.consumed === "true") {
      return { valid: false, error: "Payment already used" };
    }

    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: { ...paymentIntent.metadata, consumed: "true" },
    });

    console.log(`[Stripe] PaymentIntent validated and consumed: ${paymentIntentId}`);
    return { valid: true };
  } catch (error) {
    console.error(`[Stripe] Error validating PaymentIntent ${paymentIntentId}:`, error);
    return { valid: false, error: "Invalid payment ID" };
  }
}

export function useStripe(app: AixyzServer, config: StripeConfig): RequestHandler {
  const secretKey = config.secretKey || process.env.STRIPE_SECRET_KEY;

  if (config.enabled && secretKey) {
    initializeStripe(secretKey);

    // Add endpoint to create payment intents
    app.express.post("/stripe/create-payment-intent", express.json(), async (req, res) => {
      console.log("[Stripe] create-payment-intent endpoint hit");
      try {
        const result = await createPaymentIntent({
          priceInCents: config.priceInCents,
        });
        res.json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create payment intent";
        console.error("[Stripe] Failed to create payment intent:", message);
        const status = message === "Stripe not configured" ? 503 : 500;
        res.status(status).json({ error: message });
      }
    });
  }

  // Return middleware that checks for Stripe payments
  return async (req, res, next) => {
    if (!config.enabled || !secretKey || !stripe) {
      return next();
    }

    const stripePaymentIntentId = req.headers["x-stripe-payment-intent-id"] as string;
    if (stripePaymentIntentId) {
      const result = await validateAndConsumePaymentIntent(stripePaymentIntentId, config.priceInCents);
      if (result.valid) {
        return next();
      }
      return res.status(402).json({
        error: "Payment Required",
        message: result.error,
      });
    }

    // No Stripe payment provided, continue to x402
    return next();
  };
}
