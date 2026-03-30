import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { tool } from "ai";
import type { Accepts } from "aixyz/accepts";
import { z } from "zod";

const DEFAULT_FOLDER = "txt";
// Keep blobs light while allowing reasonably large snippets.
const MAX_TEXT_LENGTH = 50_000;

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default tool({
  description: "Store a private UTF-8 .txt file (up to 50k chars) in Vercel Blob and return its ID.",
  inputSchema: z.object({
    text: z.string().min(1).max(MAX_TEXT_LENGTH).describe("Plain text content to store as a .txt blob."),
  }),
  execute: async ({ text }) => {
    const id = randomUUID().replace(/-/g, "");
    const path = `${DEFAULT_FOLDER}/${id}.txt`;

    const blob = await put(path, text, {
      access: "private",
      contentType: "text/plain; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: false,
    });

    return { id };
  },
});
