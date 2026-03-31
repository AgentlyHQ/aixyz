import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { tool } from "ai";
import type { Accepts } from "aixyz/accepts";
import { z } from "zod";

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default tool({
  description: "Store text and return its ID.",
  inputSchema: z.object({
    text: z.string().min(1).max(50_000).describe("Plain text content to store."),
  }),
  execute: async ({ text }) => {
    const id = randomUUID();
    const path = `${id}.txt`;

    await put(path, text, {
      access: "private",
      contentType: "text/plain; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: false,
    });

    return { id };
  },
});
