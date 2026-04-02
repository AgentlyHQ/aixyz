import { tool } from "ai";
import { z } from "zod";
import { lw } from "./lw";

export default tool({
  description:
    "Access a paid API using the L402 protocol. Automatically handles the HTTP 402 payment challenge — " +
    "pays the Lightning invoice and retries with the proof-of-payment token.",
  inputSchema: z.object({
    url: z.string().url().describe("The L402-protected API endpoint URL"),
  }),
  execute: async ({ url }) => {
    return await lw(["pay-api", url]);
  },
});
