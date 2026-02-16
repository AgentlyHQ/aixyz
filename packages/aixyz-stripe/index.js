"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.experimental_useStripePaymentIntent = experimental_useStripePaymentIntent;
const express_1 = __importDefault(require("express"));
let stripe = null;
function initializeStripe(secretKey) {
  if (stripe) return;
  try {
    // Dynamically import Stripe to avoid requiring it as a dependency
    const Stripe = require("stripe");
    stripe = new Stripe(secretKey, {
      apiVersion: "2026-01-28.clover",
    });
    console.log("[Stripe] Initialized successfully");
  } catch (error) {
    console.warn("[Stripe] Failed to initialize:", error instanceof Error ? error.message : error);
    stripe = null;
  }
}
async function createPaymentIntent(options) {
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
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  };
}
async function validateAndConsumePaymentIntent(paymentIntentId, expectedAmountCents) {
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
    console.error("[Stripe] Error validating PaymentIntent %s:", paymentIntentId, error);
    return { valid: false, error: "Invalid payment ID" };
  }
}
/**
 * Experimental Stripe PaymentIntent adapter for aixyz.
 * Automatically configures Stripe payment validation from environment variables.
 *
 * Environment variables:
 * - STRIPE_SECRET_KEY: Stripe secret key (required to enable Stripe)
 * - STRIPE_PRICE_CENTS: Price per request in cents (default: 100)
 */
function experimental_useStripePaymentIntent(app) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceInCents = Number(process.env.STRIPE_PRICE_CENTS) || 100;
  if (!secretKey) {
    console.log("[Stripe] STRIPE_SECRET_KEY not set, Stripe payments disabled");
    return;
  }
  initializeStripe(secretKey);
  // Add endpoint to create payment intents
  app.express.post("/stripe/create-payment-intent", express_1.default.json(), async (req, res) => {
    console.log("[Stripe] create-payment-intent endpoint hit");
    try {
      const result = await createPaymentIntent({ priceInCents });
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create payment intent";
      console.error("[Stripe] Failed to create payment intent:", message);
      const status = message === "Stripe not configured" ? 503 : 500;
      res.status(status).json({ error: message });
    }
  });
  // Add middleware that checks for Stripe payments
  app.express.use(async (req, res, next) => {
    if (!stripe) {
      return next();
    }
    const stripePaymentIntentId = req.headers["x-stripe-payment-intent-id"];
    if (stripePaymentIntentId) {
      const result = await validateAndConsumePaymentIntent(stripePaymentIntentId, priceInCents);
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
  });
}
