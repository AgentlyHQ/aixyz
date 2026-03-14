import { tool } from "ai";
import { z } from "zod";

const LENGTH_UNITS = [
  "meter",
  "kilometer",
  "centimeter",
  "millimeter",
  "mile",
  "yard",
  "foot",
  "inch",
  "nautical_mile",
] as const;
type LengthUnit = (typeof LENGTH_UNITS)[number];

// All conversion factors relative to 1 meter
const TO_METERS: Record<LengthUnit, number> = {
  meter: 1,
  kilometer: 1000,
  centimeter: 0.01,
  millimeter: 0.001,
  mile: 1609.344,
  yard: 0.9144,
  foot: 0.3048,
  inch: 0.0254,
  nautical_mile: 1852,
};

export default tool({
  description: "Convert a length or distance value between different units (metric and imperial).",
  inputSchema: z.object({
    value: z.number().describe("The numeric value to convert"),
    from: z.enum(LENGTH_UNITS).describe("The unit to convert from"),
    to: z.enum(LENGTH_UNITS).describe("The unit to convert to"),
  }),
  execute: async ({ value, from, to }) => {
    const meters = value * TO_METERS[from];
    const result = meters / TO_METERS[to];
    return {
      input: { value, unit: from },
      output: { value: parseFloat(result.toPrecision(10)), unit: to },
    };
  },
});
