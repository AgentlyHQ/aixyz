import { HTTPFacilitatorClient } from "@x402/core/server";
import { facilitator } from "./coinbase.js";

export function getFacilitatorClient() {
  if (process.env.CDP_API_KEY_ID) {
    return new HTTPFacilitatorClient(facilitator);
  }

  return new HTTPFacilitatorClient({
    url: process.env.X402_FACILITATOR_URL || "https://www.x402.org/facilitator",
  });
}
