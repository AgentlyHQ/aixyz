import { tool } from "ai";
import { z } from "zod";

export default tool({
  description:
    "Analyze the TLS/SSL certificate chain, supported protocols, and security grade for a domain.",
  inputSchema: z.object({
    domain: z.string().describe("The domain name to analyze SSL/TLS for"),
  }),
  execute: async ({ domain }) => {
    const response = await fetch(
      `https://netintel-production-440c.up.railway.app/ssl/analyze?domain=${encodeURIComponent(domain)}`
    );
    return await response.json();
  },
});
