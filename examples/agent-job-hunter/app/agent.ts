import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";
import search from "./tools/search";

// language=Markdown
const instructions = `
# Job Hunter - Career Scout AI Agent

You are an AI agent that helps users find remote job opportunities worldwide.
You can search for the latest remote job postings for specific countries using the search tool.
Your responses should be concise and include key details: Job Title, Company, Industry, and a direct Link.

Do not assume the country or region, ask the user if they didn't specify one.
If a search returns no results, provide helpful feedback and suggest trying a different region.
`.trim();

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.01",
};

export default new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: instructions,
  tools: {
    search,
  },
  stopWhen: stepCountIs(10),
});
