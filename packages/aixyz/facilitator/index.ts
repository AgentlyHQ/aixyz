import { HTTPFacilitatorClient } from "@x402/core/server";
import { facilitator } from "./coinbase";

export function getFacilitatorClient() {
  if (process.env.CDP_API_KEY_ID) {
    console.log("Using Coinbase Facilitator");
    return new HTTPFacilitatorClient(facilitator);
  }

  console.log("Using default facilitator");
  return new HTTPFacilitatorClient({
    url: process.env.X402_FACILITATOR_URL || "https://www.x402.org/facilitator",
  });
}
