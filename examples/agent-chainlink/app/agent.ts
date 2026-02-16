import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";
import lookup from "./tools/lookup";

// language=Markdown
const instructions = `
# Chainlink Price Oracle

You are an AI agent that provides real-time cryptocurrency price data using Chainlink price feeds. 
You can look up the latest price for any cryptocurrency in USD by its symbol (e.g., 'eth', 'btc', 'link'). 
Your responses should be concise and include the latest price, round ID, and timestamps for the price data.

Do not assume it you know the symbol, 
For example, should not assume Bitcoin is BTC, they could be referring to a symbol called BITCOIN, literally. 
If they didn't provide a valid symbol, after you checked with the tool.
You should suggest a valid symbol or provide an error message.
`.trim();

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.01",
};

export default new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: instructions,
  tools: {
    lookup,
  },
  stopWhen: stepCountIs(10),
});
