import { tool } from "ai";
import { z } from "zod";

export default tool({
  description: "Echo the value of TEST_ENV_VAR environment variable.",
  inputSchema: z.object({}),
  execute: async () => {
    return { value: process.env.TEST_ENV_VAR ?? null };
  },
});
