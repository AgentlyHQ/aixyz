import { ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";

import model from "./tools/_model";

/**
 * SLM instructions are intentionally simple, to demonstrate that even a small model can do useful work when used correctly.
 * However, SLM struggles with reasoning tasks, so we avoid asking it to do anything that requires multiple steps of reasoning. Instead, we ask it to summarise text, which is a task it can do well.
 * For stricter requirements, we could fine-tune SLM to provide better results, but we want to demonstrate that even the base model can be useful without fine-tuning.
 *
 * note: tool calling is not supported.
 * note2: SLM also is not very good at following instructions, it won't always respect the "TL;DR:" requirement.
 */
const instructions = `Summarize the user's text in one short sentence. Start with "TL;DR:"`.trim();

export const accepts: Accepts = {
  scheme: "free",
};

export default new ToolLoopAgent({
  model,
  instructions,
  maxOutputTokens: 256,
  temperature: 0.5,
});
