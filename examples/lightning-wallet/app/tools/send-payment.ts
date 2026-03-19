import { tool } from "ai";
import { z } from "zod";
import { lw } from "./lw";

export default tool({
  description: "Pay a Lightning invoice (BOLT11). Decodes the invoice first to show the amount, then pays it.",
  inputSchema: z.object({
    invoice: z.string().describe("BOLT11 Lightning invoice string (starts with lnbc)"),
  }),
  execute: async ({ invoice }) => {
    const decoded = await lw(["decode-invoice", invoice]);
    const payment = await lw(["pay-invoice", invoice]);
    return { decoded, payment };
  },
});
