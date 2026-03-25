import { tool } from "ai";
import { z } from "zod";
import { getSigner, putContent } from "../session";

export default tool({
  description: "Store a key-value pair in the current user's session. Only the same x402 signer can retrieve it later.",
  inputSchema: z.object({
    key: z.string().describe("The key to store the value under"),
    value: z.string().describe("The value to store"),
  }),
  execute: async ({ key, value }) => {
    const signer = getSigner();
    if (!signer) {
      return { success: false, error: "No authenticated signer in context" };
    }

    putContent(signer, key, value);
    return { success: true, key, signer: signer.slice(0, 10) + "..." };
  },
});
