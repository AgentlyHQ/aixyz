import { tool } from "ai";
import { z } from "zod";
import { getSession } from "aixyz/app/plugins/session";
import type { Accepts } from "aixyz/accepts";

export default tool({
  description:
    "Store a key-value pair in the current user's session. Only the same x402 signer can retrieve it later. Set value to null to delete the key.",
  inputSchema: z.object({
    key: z.string().describe("The key to store the value under"),
    value: z.string().nullable().describe("The value to store, or null to delete the key"),
  }),
  execute: async ({ key, value }) => {
    const session = getSession();
    if (!session) {
      return { success: false, error: "No authenticated signer in context" };
    }

    if (value === null) {
      const deleted = await session.delete(key);
      return { success: true, key, deleted, signer: session.payer.slice(0, 10) + "..." };
    }

    await session.set(key, value);
    return { success: true, key, signer: session.payer.slice(0, 10) + "..." };
  },
});

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.01",
};
