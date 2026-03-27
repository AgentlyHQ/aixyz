import { z } from "zod";
import { FacilitatorClient, HTTPFacilitatorClient } from "@x402/core/server";

const AcceptsX402Scheme = z.object({
  scheme: z.literal("exact"),
  price: z.string(),
  // TODO(kevin): update type to Network (`string:string`)
  network: z.string().optional(),
  payTo: z.string().optional(),
});

/** Used for multiple accepts — explicit network is required to properly register schemes on the resource server. */
const AcceptsX402EntryScheme = z.object({
  scheme: z.literal("exact"),
  price: z.string(),
  network: z.string(),
  payTo: z.string().optional(),
});

const AcceptsFreeScheme = z.object({
  scheme: z.literal("free"),
});

export type AcceptsX402 = z.infer<typeof AcceptsX402Scheme>;
export type AcceptsX402Entry = z.infer<typeof AcceptsX402EntryScheme>;
export type AcceptsX402Multi = AcceptsX402Entry[];
export type AcceptsFree = z.infer<typeof AcceptsFreeScheme>;
export type Accepts = AcceptsX402 | AcceptsFree | AcceptsX402Multi;

export const AcceptsScheme: z.ZodType<Accepts> = z.union([
  z.discriminatedUnion("scheme", [AcceptsX402Scheme, AcceptsFreeScheme]),
  z.array(AcceptsX402EntryScheme).min(1),
]);

export function normalizeAcceptsX402(accepts: AcceptsX402 | AcceptsX402Multi): AcceptsX402[] {
  return Array.isArray(accepts) ? accepts : [accepts];
}

export function isAcceptsPaid(accepts: Accepts): accepts is AcceptsX402 | AcceptsX402Multi {
  if (Array.isArray(accepts))
    return accepts.length > 0 && accepts.every((e) => e.scheme === "exact" && typeof e.network === "string");
  return accepts.scheme === "exact";
}

export type { FacilitatorClient };

export { HTTPFacilitatorClient };

/**
 * The default facilitator client provided by aixyz.
 */
export const facilitator: FacilitatorClient = new HTTPFacilitatorClient({
  url: "https://x402.use-agently.com/facilitator",
});
