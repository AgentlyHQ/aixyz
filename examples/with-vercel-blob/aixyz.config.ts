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
      name: "Put Text",
      description: "Store text and return its ID.",
      tags: ["storage", "blob", "txt"],
      examples: ["Save this note and return the ID", "Store this text for me"],
    },
    {
      id: "get-text",
      name: "Get Text",
      description: "Retrieve stored text by ID.",
      tags: ["storage", "blob", "txt", "read"],
      examples: ["Fetch the text with this ID", "Read back the note I just saved"],
    },
  ],
};

export default config;
