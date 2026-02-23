import { tool } from "ai";
import { z } from "zod";
import type { Accepts } from "aixyz/accepts";

// Optional: gate this tool behind an x402 payment when accessed via MCP.
// Remove this export to make the tool free.
export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default tool({
  description: "A short description of what this tool does.",
  inputSchema: z.object({
    input: z.string().describe("Input to the tool"),
  }),
  execute: async ({ input }) => {
    // Your tool logic here.
    return { result: input };
  },
});
