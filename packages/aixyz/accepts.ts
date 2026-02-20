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

/**
 * Returns the default facilitator client, using Coinbase CDP if `CDP_API_KEY_ID`
 * is set, otherwise falling back to the public x402.org facilitator or the URL
 * specified in the `X402_FACILITATOR_URL` environment variable.
 */
export function getDefaultFacilitator() {
  return getFacilitatorClient();
}
