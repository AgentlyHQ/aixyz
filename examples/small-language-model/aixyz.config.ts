import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "TL;DR Agent",
  description: "Summarizes text into a single sentence using an on-device Small Language Model. No API keys required.",
  version: "0.1.0",
  x402: {
    payTo: "0x0799872E07EA7a63c79357694504FE66EDfE4a0A",
    network: process.env.NODE_ENV === "production" ? "eip155:8453" : "eip155:84532",
  },
  skills: [
    {
      id: "tldr",
      name: "TL;DR",
      description: "Condense any text into a single-sentence summary using an on-device SLM",
      tags: ["tldr", "summarize", "slm"],
      examples: ["TL;DR this article", "Give me the one-liner for this paragraph", "Summarize this in one sentence"],
    },
  ],
};

export default config;
