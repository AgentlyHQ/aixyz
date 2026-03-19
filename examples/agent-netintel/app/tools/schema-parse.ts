import { tool } from "ai";
import { z } from "zod";

export default tool({
  description:
    "Extract structured data from unstructured text using an LLM. Provide the raw text and a target schema describing the fields to extract.",
  inputSchema: z.object({
    raw_text: z.string().describe("The unstructured text to extract data from"),
    target_schema: z
      .record(z.string(), z.any())
      .describe("An object describing the fields to extract and their expected types"),
  }),
  execute: async ({ raw_text, target_schema }) => {
    const response = await fetch("https://netintel-production-440c.up.railway.app/schema-parse/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text, target_schema }),
    });
    return await response.json();
  },
});
