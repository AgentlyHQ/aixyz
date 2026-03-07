import { put } from "@vercel/blob";
import { tool } from "ai";
import { z } from "zod";

const UploadBlobInputSchema = z.object({
  pathname: z.string().min(1).describe("The filename/path for the blob, e.g. 'notes/hello.txt'."),
  content: z.string().min(1).describe("The text content to upload."),
});

const UploadBlobOutputSchema = z.object({
  url: z.string().describe("The public URL of the uploaded blob."),
  pathname: z.string().describe("The pathname used to store the blob."),
  contentType: z.string().describe("The detected content type of the blob."),
  size: z.number().describe("The size of the uploaded blob in bytes."),
});

export default tool({
  description: "Upload text content to Vercel Blob storage. Returns the public URL of the stored file.",
  inputSchema: UploadBlobInputSchema,
  outputSchema: UploadBlobOutputSchema,
  execute: async ({ pathname, content }) => {
    const blob = await put(pathname, content, {
      access: "public",
      addRandomSuffix: true,
    });
    return UploadBlobOutputSchema.parse({
      url: blob.url,
      pathname: blob.pathname,
      contentType: blob.contentType,
      size: blob.size,
    });
  },
});
