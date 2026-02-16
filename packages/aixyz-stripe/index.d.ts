import type { AixyzServer } from "aixyz/server";
/**
 * Experimental Stripe PaymentIntent adapter for aixyz.
 * Automatically configures Stripe payment validation from environment variables.
 *
 * Environment variables:
 * - STRIPE_SECRET_KEY: Stripe secret key (required to enable Stripe)
 * - STRIPE_PRICE_CENTS: Price per request in cents (default: 100)
 */
export declare function experimental_useStripePaymentIntent(app: AixyzServer): void;
