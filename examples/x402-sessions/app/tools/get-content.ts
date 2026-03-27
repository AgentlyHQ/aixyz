import { tool } from "ai";
import { z } from "zod";
import { getSession } from "aixyz/app/plugins/session";
import type { Accepts } from "aixyz/accepts";

export default tool({
  description:
    "Retrieve stored content from the current user's session. Pass a key to get a specific value, or omit it to list all stored content.",
  inputSchema: z.object({
    key: z.string().optional().describe("The key to retrieve. If omitted, returns all stored content."),
  }),
  execute: async ({ key }) => {
    const session = getSession();
    if (!session) {
      return { success: false, error: "No authenticated signer in context" };
    }

    if (key) {
      const value = await session.get(key);
      if (value === undefined) {
        return { success: false, error: `No content found for key "${key}"` };
      }
      return { success: true, key, value };
    }

    const { entries } = await session.list();
    return { success: true, content: entries, count: Object.keys(entries).length };
  },
});

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};
