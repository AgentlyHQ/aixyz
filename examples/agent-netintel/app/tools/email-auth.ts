import { tool } from "ai";
import { z } from "zod";

export default tool({
  description:
    "Validate SPF, DKIM, and DMARC email authentication records for a domain with multi-selector probing and security grading.",
  inputSchema: z.object({
    domain: z.string().describe("The domain name to check email authentication for"),
  }),
  execute: async ({ domain }) => {
    const response = await fetch("https://netintel-production-440c.up.railway.app/email-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    });
    return await response.json();
  },
});
