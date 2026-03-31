import { get } from "@vercel/blob";
import { tool } from "ai";
import type { Accepts } from "aixyz/accepts";
import { z } from "zod";

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default tool({
  description: "Retrieve stored text by ID.",
  inputSchema: z.object({
    id: z.uuid().describe("The ID returned by put-text."),
  }),
  execute: async ({ id }) => {
    const result = await get(`${id}.txt`, { access: "private" });
    if (result === null) {
      return null;
    }

    const text = result.statusCode === 304 ? "" : await new Response(result.stream).text();
    return { text };
  },
});
