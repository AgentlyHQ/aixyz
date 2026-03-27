import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "with-vercel-blob",
  description: "MCP-only example that stores plain text blobs on Vercel Blob.",
  version: "0.1.0",
  x402: {
    payTo: "0x0799872E07EA7a63c79357694504FE66EDfE4a0A",
    network: process.env.NODE_ENV === "production" ? "eip155:8453" : "eip155:84532",
  },
  skills: [
    {
      id: "put-text",
      name: "Put text to Vercel Blob",
      description: "Persist a UTF-8 txt file using the put-text MCP tool.",
      tags: ["storage", "blob", "vercel", "txt"],
      examples: ["Save this note as a .txt file and return the blob URL", "Write a txt file under the logs/ folder"],
    },
    {
      id: "get-text",
      name: "Get text from Vercel Blob",
      description: "Read a private txt blob using the get-text MCP tool.",
      tags: ["storage", "blob", "vercel", "txt", "read"],
      examples: ["Fetch the content at txt/<id>.txt", "Read back the note I just saved"],
    },
  ],
};

export default config;
