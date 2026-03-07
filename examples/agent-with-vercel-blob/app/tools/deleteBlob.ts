import { del } from "@vercel/blob";
import { tool } from "ai";
import { z } from "zod";

const DeleteBlobInputSchema = z.object({
  url: z.string().url().describe("The public URL of the blob to delete."),
});

const DeleteBlobOutputSchema = z.object({
  deleted: z.boolean(),
  url: z.string(),
});

export default tool({
  description: "Delete a file from Vercel Blob storage by its URL.",
  inputSchema: DeleteBlobInputSchema,
  outputSchema: DeleteBlobOutputSchema,
  execute: async ({ url }) => {
    await del(url);
    return DeleteBlobOutputSchema.parse({ deleted: true, url });
  },
});
