import Stripe from "stripe";

let stripe: Stripe | null = null;

export function initializeStripe(): Stripe | null {
  console.log("[Stripe] initializeStripe() called");
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.warn("[Stripe] STRIPE_SECRET_KEY not found in environment");
    return null;
  }

  stripe = new Stripe(secretKey, {
    apiVersion: "2026-01-28.clover",
  });
  console.log("[Stripe] Initialized successfully with API version 2026-01-28.clover");
  return stripe;
}

// Create PaymentIntent (returns clientSecret for frontend)
export async function createPaymentIntent(options: {
  priceInCents: number;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
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

// Validate PaymentIntent from client (single-use)
export async function validateAndConsumePaymentIntent(
  paymentIntentId: string,
  expectedAmountCents: number,
): Promise<{
  valid: boolean;
  error?: string;
}> {
  if (!stripe) return { valid: false, error: "Stripe not configured" };

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Verify payment succeeded
    if (paymentIntent.status !== "succeeded") {
      return { valid: false, error: "Payment not completed" };
    }

    // Verify amount matches expected price (prevents using cheaper PaymentIntents)
    if (paymentIntent.amount < expectedAmountCents) {
      console.log(`[Stripe] Amount mismatch: got ${paymentIntent.amount}, expected ${expectedAmountCents}`);
      return { valid: false, error: "Invalid payment amount" };
    }

    // Verify PaymentIntent was created by our system (has our metadata)
    if (!paymentIntent.metadata.expected_amount) {
      console.log(`[Stripe] PaymentIntent missing expected_amount metadata: ${paymentIntentId}`);
      return { valid: false, error: "Invalid payment source" };
    }

    // Check if already consumed
    if (paymentIntent.metadata.consumed === "true") {
      return { valid: false, error: "Payment already used" };
    }

    // Mark as consumed
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
