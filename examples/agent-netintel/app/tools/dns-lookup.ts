import { tool } from "ai";
import { z } from "zod";

export default tool({
  description: "Look up DNS records for a domain, including A, AAAA, MX, TXT, NS, CNAME, and SOA records.",
  inputSchema: z.object({
    domain: z.string().describe("The domain name to look up DNS records for"),
  }),
  execute: async ({ domain }) => {
    const response = await fetch(
      `https://netintel-production-440c.up.railway.app/dns/lookup?domain=${encodeURIComponent(domain)}`
    );
    return await response.json();
  },
});
