import { tool } from "ai";
import { z } from "zod";
import { getSigner, getContent, listContent } from "../session";

export default tool({
  description:
    "Retrieve stored content from the current user's session. Pass a key to get a specific value, or omit it to list all stored content.",
  inputSchema: z.object({
    key: z.string().optional().describe("The key to retrieve. If omitted, returns all stored content."),
  }),
  execute: async ({ key }) => {
    const signer = getSigner();
    if (!signer) {
      return { success: false, error: "No authenticated signer in context" };
    }

    if (key) {
      const value = getContent(signer, key);
      if (value === undefined) {
        return { success: false, error: `No content found for key "${key}"` };
      }
      return { success: true, key, value };
    }

    const all = listContent(signer);
    return { success: true, content: all, count: Object.keys(all).length };
  },
});
