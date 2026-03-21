import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "NetIntel Agent",
  description:
    "Network intelligence agent powered by NetIntel x402 API. Extract structured data from unstructured text, look up DNS records, analyze SSL certificates, validate email authentication, and check IP reputation — all pay-per-call via x402 on Base.",
  version: "0.1.0",
  x402: {
    payTo: "0x0000000000000000000000000000000000000000",
    network:
      process.env.NODE_ENV === "production" ? "eip155:8453" : "eip155:84532",
  },
  skills: [
    {
      id: "schema-parse",
      name: "Structured Data Extraction",
      description:
        "Extract structured data from any unstructured text using LLM — contacts, invoices, records, any schema you define",
      tags: ["data", "extraction", "llm", "parsing", "structured"],
      examples: [
        "Extract contact info from this email signature",
        "Pull invoice details from this block of text",
        "Parse this job posting into structured fields",
      ],
    },
    {
      id: "dns-lookup",
      name: "DNS Lookup",
      description:
        "Resolve all DNS record types for a domain, parse SPF/DKIM/DMARC, check propagation across resolvers",
      tags: ["dns", "network", "security"],
      examples: [
        "Look up DNS records for example.com",
        "Check SPF record for gmail.com",
      ],
    },
    {
      id: "ssl-analyze",
      name: "SSL Analysis",
      description:
        "Analyze TLS certificate chain, supported protocols, and return an overall security grade A-F",
      tags: ["ssl", "tls", "security", "certificate"],
      examples: [
        "Check SSL certificate for github.com",
        "What TLS version does cloudflare.com use?",
      ],
    },
    {
      id: "email-auth",
      name: "Email Authentication",
      description:
        "Validate SPF, DKIM, and DMARC records for a domain with multi-selector probing and security grading",
      tags: ["email", "spf", "dkim", "dmarc", "security"],
      examples: [
        "Check email security for gmail.com",
        "Does example.com have DMARC configured?",
      ],
    },
  ],
};

export default config;
