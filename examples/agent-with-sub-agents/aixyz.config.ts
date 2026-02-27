import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Multi-Specialist Agent",
  description: "A multi-agent service with a coordinator and two specialists — math and text analysis.",
  version: "0.1.0",
  x402: {
    payTo: "0x0799872E07EA7a63c79357694504FE66EDfE4a0A",
    network: process.env.NODE_ENV === "production" ? "eip155:8453" : "eip155:84532",
  },
  skills: [
    {
      id: "coordinator",
      name: "Coordinator",
      description: "Routes requests to the right specialist — math or text analysis.",
      tags: ["coordinator", "routing"],
      examples: ["What can you help me with?", "Which specialist handles math?"],
    },
    {
      id: "math",
      name: "Math",
      description: "Performs arithmetic: addition, subtraction, multiplication, and division.",
      tags: ["math", "arithmetic", "calculator"],
      examples: ["What is 42 × 7?", "Divide 144 by 12", "Add 55 and 37"],
    },
    {
      id: "text-analysis",
      name: "Text Analysis",
      description: "Counts words, characters, and sentences in a piece of text.",
      tags: ["text", "analysis", "word-count"],
      examples: ["How many words are in this paragraph?", "Count the characters in my text"],
    },
  ],
};

export default config;
