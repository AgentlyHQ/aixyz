import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { tool } from "ai";
import type { Accepts } from "aixyz/accepts";
import { z } from "zod";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_TTL_DAYS = 365;
const DEFAULT_FOLDER = "txt";
// Keep blobs lightweight for the example and MCP transport while still allowing rich snippets.
const MAX_TEXT_LENGTH = 50_000;
// Prevent overly long folder prefixes that could create unwieldy blob paths.
const MAX_FOLDER_LENGTH = 120;

export type TxtPlan = {
  id: string;
  path: string;
  createdAt: Date;
  expiresAt: Date;
};

function normalizeFolder(folder?: string): string | undefined {
  if (!folder) return undefined;
  const trimmed = folder.trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed) return undefined;
  return trimmed
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

function clampTtl(days?: number): number {
  if (!days || Number.isNaN(days)) return DEFAULT_TTL_DAYS;
  return Math.min(DEFAULT_TTL_DAYS, Math.max(1, Math.trunc(days)));
}

export function createTxtPlan(args: { folder?: string; expiresInDays?: number; now?: Date } = {}): TxtPlan {
  const { folder, expiresInDays, now = new Date() } = args;
  const safeFolder = normalizeFolder(folder) ?? DEFAULT_FOLDER;
  const id = randomUUID().replace(/-/g, "");
  const createdAt = now;
  const expiresAt = new Date(createdAt.getTime() + clampTtl(expiresInDays) * MS_PER_DAY);
  const path = `${safeFolder}/${id}.txt`;

  return { id, path, createdAt, expiresAt };
}

const inputSchema = z.object({
  text: z.string().min(1).max(MAX_TEXT_LENGTH).describe("Plain text content to store as a .txt blob."),
  folder: z
    .string()
    .trim()
    .max(MAX_FOLDER_LENGTH)
    .regex(/^[a-zA-Z0-9/_-]+$/, "Only alphanumeric, /, -, and _ are allowed")
    .describe("Optional folder prefix for organizing blobs (default: txt).")
    .optional(),
  expiresInDays: z
    .number()
    .int()
    .min(1)
    .max(DEFAULT_TTL_DAYS)
    .describe(`Days before the blob expires (default: ${DEFAULT_TTL_DAYS}).`)
    .optional(),
});

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default tool({
  description: "Store a private UTF-8 .txt file (up to 50k chars) in Vercel Blob and return its URL and metadata.",
  inputSchema,
  execute: async ({ text, folder, expiresInDays }) => {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new Error("BLOB_READ_WRITE_TOKEN is required to call putTxt.");
    }

    const plan = createTxtPlan({ folder, expiresInDays });
    const payload = [
      "# putTxt blob",
      `createdAt=${plan.createdAt.toISOString()}`,
      `expiresAt=${plan.expiresAt.toISOString()}`,
      "",
      text,
    ].join("\n");
    const bytes = new TextEncoder().encode(payload).length;

    const blob = await put(plan.path, payload, {
      access: "private",
      contentType: "text/plain; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: false,
      token,
    });

    return {
      id: plan.id,
      path: plan.path,
      createdAt: plan.createdAt.toISOString(),
      expiresAt: plan.expiresAt.toISOString(),
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      pathname: blob.pathname,
      etag: blob.etag,
      contentType: blob.contentType,
      bytes,
    };
  },
});
