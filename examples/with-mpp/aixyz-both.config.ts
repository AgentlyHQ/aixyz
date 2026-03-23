import type { AixyzConfig } from "aixyz/config";

/**
 * Example: Both x402 and MPP configured simultaneously
 *
 * When both are present, aixyz serves both payment protocols at once.
 * Clients that send `Authorization: Payment ...` → MPP path
 * Clients that send `X-Payment: ...`             → x402 path
 * Clients with no credential                     → 402 with both challenges
 *
 * Useful when you want to maximise payment method compatibility.
 */
const config: AixyzConfig = {
  name: "Unit Conversion Agent",
  description: "AI agent that converts values between metric, imperial, and other measurement systems.",
  version: "0.1.0",

  // x402: EVM/Base payments (existing clients)
  x402: {
    payTo: process.env.X402_PAY_TO ?? "0x0799872E07EA7a63c79357694504FE66EDfE4a0A",
    network: process.env.NODE_ENV === "production" ? "eip155:8453" : "eip155:84532",
  },

  // mpp: Tempo / Stripe / Lightning (new clients)
  mpp: {
    recipient: process.env.MPP_RECIPIENT ?? "0x0799872E07EA7a63c79357694504FE66EDfE4a0A",
    methods: ["tempo", "stripe"],
    stripeSecretKey: process.env.MPP_STRIPE_SECRET_KEY,
  },

  skills: [
    {
      id: "convert-length",
      name: "Convert Length",
      description: "Convert length and distance values between metric and imperial units",
      tags: ["length", "distance", "metric", "imperial"],
      examples: ["Convert 100 meters to feet"],
    },
  ],
};

export default config;
