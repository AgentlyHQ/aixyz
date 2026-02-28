import { tool } from "ai";
import { z } from "zod";

const OPERATIONS = ["add", "subtract", "multiply", "divide"] as const;
type Operation = (typeof OPERATIONS)[number];

export default tool({
  description: "Perform basic arithmetic: add, subtract, multiply, or divide two numbers.",
  inputSchema: z.object({
    a: z.number().describe("The first operand"),
    b: z.number().describe("The second operand"),
    operation: z.enum(OPERATIONS).describe("The arithmetic operation to perform"),
  }),
  execute: async ({ a, b, operation }) => {
    const ops: Record<Operation, () => number | string> = {
      add: () => a + b,
      subtract: () => a - b,
      multiply: () => a * b,
      divide: () => (b === 0 ? "Error: division by zero" : a / b),
    };
    return { a, b, operation, result: ops[operation]() };
  },
});
