import { HTTPFacilitatorClient } from "aixyz/accepts";

export const facilitator = process.env.X402_FACILITATOR_URL
  ? new HTTPFacilitatorClient({ url: process.env.X402_FACILITATOR_URL })
  : undefined;
