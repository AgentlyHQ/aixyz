import { get } from "@vercel/blob";
import { tool } from "ai";
import type { Accepts } from "aixyz/accepts";
import { z } from "zod";

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default tool({
  description: "Fetch a private .txt blob from Vercel Blob and return its text content.",
  inputSchema: z.object({
    path: z.string().min(1).describe("Blob pathname (e.g., txt/<uuid>.txt) or full blob URL."),
  }),
  execute: async ({ path }) => {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new Error("BLOB_READ_WRITE_TOKEN is required to call get-text.");
    }

    const result = await get(path, { access: "private", token });
    if (result.statusCode === 304) {
      return { path: result.blob.pathname, text: "", contentType: result.blob.contentType, size: result.blob.size };
    }

    const text = await new Response(result.stream).text();
    return {
      path: result.blob.pathname,
      text,
      contentType: result.blob.contentType,
      size: result.blob.size,
    };
  },
});
