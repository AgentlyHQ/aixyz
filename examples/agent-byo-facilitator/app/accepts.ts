import { HTTPFacilitatorClient } from "@x402/core/server";

// Bring your own facilitator: export a custom facilitator client to replace
// the default ENV-based selection (CDP_API_KEY_ID / X402_FACILITATOR_URL).
// The auto-generated server will import this and pass it to AixyzServer.
export const facilitator = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL ?? "https://www.x402.org/facilitator",
});
