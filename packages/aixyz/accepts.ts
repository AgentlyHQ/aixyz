import { z } from "zod";
import { FacilitatorClient, HTTPFacilitatorClient } from "@x402/core/server";

export type Accepts = AcceptsX402 | AcceptsFree;

export type AcceptsX402 = {
  scheme: "exact";
  price: string;
  network?: string;
  payTo?: string;
};

export type AcceptsFree = {
  scheme: "free";
};

export const AcceptsScheme = z.discriminatedUnion("scheme", [
  z.object({
    scheme: z.literal("exact"),
    price: z.string(),
    network: z.string().optional(),
    payTo: z.string().optional(),
  }),
  z.object({
    scheme: z.literal("free"),
  }),
]);

export type { FacilitatorClient };

export { HTTPFacilitatorClient };

/**
 * The default facilitator client provided by aixyz.
 */
export const facilitator: FacilitatorClient = new HTTPFacilitatorClient({
  url: "https://x402.use-agently.com/facilitator",
});
