import { list } from "@vercel/blob";
import { tool } from "ai";
import { z } from "zod";

const ListBlobsInputSchema = z.object({
  prefix: z.string().optional().describe("Optional path prefix to filter blobs, e.g. 'notes/'."),
  limit: z.number().int().min(1).max(1000).default(100).describe("Maximum number of blobs to return (1–1000)."),
});

const BlobItemSchema = z.object({
  url: z.string(),
  pathname: z.string(),
  contentType: z.string(),
  size: z.number(),
  uploadedAt: z.string(),
});

const ListBlobsOutputSchema = z.object({
  blobs: z.array(BlobItemSchema),
  count: z.number(),
});

export default tool({
  description: "List files stored in Vercel Blob storage. Optionally filter by path prefix.",
  inputSchema: ListBlobsInputSchema,
  outputSchema: ListBlobsOutputSchema,
  execute: async ({ prefix, limit }) => {
    const result = await list({ prefix, limit });
    return ListBlobsOutputSchema.parse({
      blobs: result.blobs.map((b) => ({
        url: b.url,
        pathname: b.pathname,
        contentType: b.contentType,
        size: b.size,
        uploadedAt: b.uploadedAt.toISOString(),
      })),
      count: result.blobs.length,
    });
  },
});
