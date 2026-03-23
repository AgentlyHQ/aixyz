import type { AixyzConfig } from "aixyz/config";

/**
 * Example: MPP-only payment configuration
 *
 * This agent accepts payments via the Machine Payments Protocol (MPP),
 * supporting Tempo stablecoins, Stripe cards, and Lightning Bitcoin.
 *
 * Install mppx to enable: bun add mppx
 *
 * @see https://mpp.dev
 */
const config: AixyzConfig = {
  name: "Unit Conversion Agent",
  description: "AI agent that converts values between metric, imperial, and other measurement systems.",
  version: "0.1.0",

  mpp: {
    // EVM address to receive Tempo stablecoin payments
    recipient: process.env.MPP_RECIPIENT ?? "0x0799872E07EA7a63c79357694504FE66EDfE4a0A",
    // pathUSD on Tempo mainnet (default)
    currency: "0x20c0000000000000000000000000000000000000",
    // Accept Tempo stablecoins and Stripe cards
    methods: ["tempo", "stripe"],
    // Stripe secret key (required when "stripe" is in methods)
    stripeSecretKey: process.env.MPP_STRIPE_SECRET_KEY,
  },

  skills: [
    {
      id: "convert-length",
      name: "Convert Length",
      description: "Convert length and distance values between metric and imperial units",
      tags: ["length", "distance", "metric", "imperial"],
      examples: ["Convert 100 meters to feet", "How many miles is 10 kilometers?"],
    },
  ],
};

export default config;
