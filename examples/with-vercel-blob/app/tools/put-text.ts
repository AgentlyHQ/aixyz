import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { tool } from "ai";
import type { Accepts } from "aixyz/accepts";
import { z } from "zod";

const DEFAULT_FOLDER = "txt";
// Keep blobs light while allowing reasonably large snippets.
const MAX_TEXT_LENGTH = 50_000;

function normalizeFolder(folder?: string): string {
  if (!folder) return DEFAULT_FOLDER;
  const trimmed = folder.trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed) return DEFAULT_FOLDER;
  return trimmed
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

export function buildTxtPath(folder?: string): { id: string; path: string } {
  const id = randomUUID().replace(/-/g, "");
  const safeFolder = normalizeFolder(folder);
  return { id, path: `${safeFolder}/${id}.txt` };
}

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default tool({
  description: "Store a private UTF-8 .txt file (up to 50k chars) in Vercel Blob and return its URLs.",
  inputSchema: z.object({
    text: z.string().min(1).max(MAX_TEXT_LENGTH).describe("Plain text content to store as a .txt blob."),
    folder: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9/_-]+$/, "Only alphanumeric, /, -, and _ are allowed")
      .describe("Optional folder prefix (default: txt).")
      .optional(),
  }),
  execute: async ({ text, folder }) => {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new Error("BLOB_READ_WRITE_TOKEN is required to call put-text.");
    }

    const { id, path } = buildTxtPath(folder);

    const blob = await put(path, text, {
      access: "private",
      contentType: "text/plain; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: false,
      token,
    });

    return {
      id,
      path,
      url: blob.url,
      downloadUrl: blob.downloadUrl,
    };
  },
});
