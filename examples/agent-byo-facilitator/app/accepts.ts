import { HTTPFacilitatorClient } from "@x402/core/server";

// the default Facilitator provided by aixyz.
export const facilitator = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL ?? "https://www.x402.org/facilitator",
});
