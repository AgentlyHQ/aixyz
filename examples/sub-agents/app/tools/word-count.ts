import { tool } from "ai";
import { z } from "zod";

export default tool({
  description: "Count the number of words, characters, and sentences in a piece of text.",
  inputSchema: z.object({
    text: z.string().describe("The text to analyze"),
  }),
  execute: async ({ text }) => {
    const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
    const characters = text.length;
    const sentences = (text.match(/[.!?]+/g) ?? []).length;
    return { words, characters, sentences };
  },
});
