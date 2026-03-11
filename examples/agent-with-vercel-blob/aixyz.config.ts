import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Vercel Blob Agent",
  description: "An AI agent that stores, retrieves, and manages files using Vercel Blob storage.",
  version: "0.1.0",
  x402: {
    payTo: "0x0799872E07EA7a63c79357694504FE66EDfE4a0A",
    network: process.env.NODE_ENV === "production" ? "eip155:8453" : "eip155:84532",
  },
  skills: [
    {
      id: "upload-blob",
      name: "Upload File",
      description: "Upload text content or data to Vercel Blob storage and receive a public URL",
      tags: ["upload", "storage", "blob", "file"],
      examples: ["Store this text: Hello World", "Save my notes to blob storage", "Upload this content as a file"],
    },
    {
      id: "list-blobs",
      name: "List Files",
      description: "List all files stored in Vercel Blob with their URLs and metadata",
      tags: ["list", "storage", "blob", "files"],
      examples: ["Show me all stored files", "List my blobs", "What files are in storage?"],
    },
    {
      id: "delete-blob",
      name: "Delete File",
      description: "Delete a file from Vercel Blob storage by its URL",
      tags: ["delete", "remove", "storage", "blob"],
      examples: ["Delete this file: https://...", "Remove the blob at this URL"],
    },
  ],
};

export default config;
