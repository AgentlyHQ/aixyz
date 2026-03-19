import { tool } from "ai";
import { z } from "zod";
import { lw } from "./lw";

export default tool({
  description: "Check the agent's Bitcoin Lightning wallet balance, including available sats and budget limits.",
  inputSchema: z.object({}),
  execute: async () => {
    return await lw(["balance"]);
  },
});
