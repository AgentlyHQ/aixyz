import { tool } from "ai";
import { z } from "zod";

const TEMPERATURE_UNITS = ["celsius", "fahrenheit", "kelvin"] as const;

export default tool({
  description: "Convert a temperature value between Celsius, Fahrenheit, and Kelvin.",
  inputSchema: z.object({
    value: z.number().describe("The numeric temperature value to convert"),
    from: z.enum(TEMPERATURE_UNITS).describe("The unit to convert from"),
    to: z.enum(TEMPERATURE_UNITS).describe("The unit to convert to"),
  }),
  execute: async ({ value, from, to }) => {
    // First convert to Celsius as intermediate
    let celsius: number;
    if (from === "celsius") {
      celsius = value;
    } else if (from === "fahrenheit") {
      celsius = (value - 32) * (5 / 9);
    } else {
      celsius = value - 273.15;
    }

    // Then convert from Celsius to target unit
    let result: number;
    if (to === "celsius") {
      result = celsius;
    } else if (to === "fahrenheit") {
      result = celsius * (9 / 5) + 32;
    } else {
      result = celsius + 273.15;
    }

    return {
      input: { value, unit: from },
      output: { value: parseFloat(result.toPrecision(10)), unit: to },
    };
  },
});
