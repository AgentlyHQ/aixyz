import { FacilitatorClient, HTTPFacilitatorClient } from "@x402/core/server";
import { getFacilitatorClient } from "./facilitator";

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

export type { FacilitatorClient };

export { HTTPFacilitatorClient };

/**
 * The default facilitator client provided by aixyz.
 */
export const facilitator: FacilitatorClient = getFacilitatorClient();
