import { tool } from "ai";
import { z } from "zod";

const WEIGHT_UNITS = ["kilogram", "gram", "milligram", "pound", "ounce", "ton", "stone"] as const;
type WeightUnit = (typeof WEIGHT_UNITS)[number];

// All conversion factors relative to 1 kilogram
const TO_KILOGRAMS: Record<WeightUnit, number> = {
  kilogram: 1,
  gram: 0.001,
  milligram: 0.000001,
  pound: 0.45359237,
  ounce: 0.028349523125,
  ton: 1000,
  stone: 6.35029318,
};

export default tool({
  description: "Convert a weight or mass value between different units (metric and imperial).",
  inputSchema: z.object({
    value: z.number().describe("The numeric value to convert"),
    from: z.enum(WEIGHT_UNITS).describe("The unit to convert from"),
    to: z.enum(WEIGHT_UNITS).describe("The unit to convert to"),
  }),
  execute: async ({ value, from, to }) => {
    const kg = value * TO_KILOGRAMS[from];
    const result = kg / TO_KILOGRAMS[to];
    return {
      input: { value, unit: from },
      output: { value: parseFloat(result.toPrecision(10)), unit: to },
    };
  },
});
