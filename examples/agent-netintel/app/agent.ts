import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";

import schemaParse from "./tools/schema-parse";
import dnsLookup from "./tools/dns-lookup";
import sslAnalyze from "./tools/ssl-analyze";
import emailAuth from "./tools/email-auth";

const instructions = `
# Network Intelligence Agent

You are a network intelligence assistant that can extract structured data from unstructured text and perform network/security lookups.

## Guidelines

- Use \`schemaParse\` to extract structured data from raw text given a target schema describing the fields to extract.
- Use \`dnsLookup\` to resolve DNS records for a domain.
- Use \`sslAnalyze\` to analyze TLS/SSL certificates and security for a domain.
- Use \`emailAuth\` to validate SPF, DKIM, and DMARC email authentication records for a domain.
- When performing network lookups, clearly present the results in a readable format.
- If the user's request is ambiguous, ask for clarification.
`.trim();

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.005",
};

export default new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: instructions,
  tools: { schemaParse, dnsLookup, sslAnalyze, emailAuth },
  stopWhen: stepCountIs(10),
});
