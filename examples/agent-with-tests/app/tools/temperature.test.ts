import { describe, expect, test } from "bun:test";
import type { ToolExecutionOptions } from "ai";
import convertTemperature from "./temperature";

// Tools can be called directly in tests, bypassing accepts (payment config)
const ctx = { toolCallId: "test", messages: [] } as ToolExecutionOptions;

describe("convertTemperature", () => {
  test("converts Celsius to Fahrenheit", async () => {
    const result = await convertTemperature.execute!({ value: 100, from: "celsius", to: "fahrenheit" }, ctx);
    expect(result.output.value).toBeCloseTo(212, 5);
    expect(result.output.unit).toBe("fahrenheit");
    expect(result.input).toEqual({ value: 100, unit: "celsius" });
  });

  test("converts Fahrenheit to Celsius", async () => {
    const result = await convertTemperature.execute!({ value: 32, from: "fahrenheit", to: "celsius" }, ctx);
    expect(result.output.value).toBeCloseTo(0, 5);
    expect(result.output.unit).toBe("celsius");
  });

  test("converts Celsius to Kelvin", async () => {
    const result = await convertTemperature.execute!({ value: 0, from: "celsius", to: "kelvin" }, ctx);
    expect(result.output.value).toBeCloseTo(273.15, 5);
    expect(result.output.unit).toBe("kelvin");
  });

  test("converts Kelvin to Celsius", async () => {
    const result = await convertTemperature.execute!({ value: 273.15, from: "kelvin", to: "celsius" }, ctx);
    expect(result.output.value).toBeCloseTo(0, 5);
    expect(result.output.unit).toBe("celsius");
  });

  test("converts Kelvin to Fahrenheit", async () => {
    const result = await convertTemperature.execute!({ value: 373.15, from: "kelvin", to: "fahrenheit" }, ctx);
    expect(result.output.value).toBeCloseTo(212, 4);
    expect(result.output.unit).toBe("fahrenheit");
  });

  test("same-unit conversion returns same value", async () => {
    const result = await convertTemperature.execute!({ value: 25, from: "celsius", to: "celsius" }, ctx);
    expect(result.output.value).toBeCloseTo(25, 5);
    expect(result.output.unit).toBe("celsius");
  });

  test("preserves input in result", async () => {
    const result = await convertTemperature.execute!({ value: 72, from: "fahrenheit", to: "celsius" }, ctx);
    expect(result.input).toEqual({ value: 72, unit: "fahrenheit" });
  });
});
