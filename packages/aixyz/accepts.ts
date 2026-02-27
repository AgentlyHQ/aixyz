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

export const DEFAULT_FACILITATOR_URL = "https://x402.use-agently.com/facilitator";

/**
 * Create a facilitator client with a custom URL.
 * Falls back to the default aixyz-hosted facilitator if no URL is provided.
 */
export function createFacilitator(url?: string): FacilitatorClient {
  return new HTTPFacilitatorClient({
    url: url ?? DEFAULT_FACILITATOR_URL,
  });
}

/**
 * The default facilitator client provided by aixyz.
 */
export const facilitator: FacilitatorClient = createFacilitator();
