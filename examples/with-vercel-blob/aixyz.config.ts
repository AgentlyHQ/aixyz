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
      id: "store-text",
      name: "Store text to Vercel Blob",
      description: "Persist a UTF-8 txt file with metadata using the putTxt MCP tool.",
      tags: ["storage", "blob", "vercel", "txt"],
      examples: [
        "Save this meeting note as a .txt file and return the blob URL",
        "Persist a private txt blob that expires in 90 days",
        "Write a txt file under the logs/ folder",
      ],
    },
  ],
};

export default config;
