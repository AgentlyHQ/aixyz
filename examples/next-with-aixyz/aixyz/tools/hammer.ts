import { tool } from "ai";
import { z } from "zod";

export const accepts = {
  scheme: "free",
};

export default tool({
  description: "Hammer a nail into something.",
  inputSchema: z.object({
    nail: z.string(),
  }),
  execute: async ({ nail }) => {
    return "hamming " + nail;
  },
});
