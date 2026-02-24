import { describe, expect, test } from "bun:test";
import convertTemperature from "./temperature";

type Execute = NonNullable<typeof convertTemperature.execute>;
type ExecuteResult = Exclude<Awaited<ReturnType<Execute>>, AsyncIterable<unknown>>;

function execute(input: Parameters<Execute>[0]): Promise<ExecuteResult> {
  return convertTemperature.execute!(input, { toolCallId: "test", messages: [] }) as Promise<ExecuteResult>;
}

describe("convertTemperature", () => {
  test("converts Celsius to Fahrenheit", async () => {
    const result = await execute({ value: 100, from: "celsius", to: "fahrenheit" });
    expect(result.output.value).toBeCloseTo(212, 5);
    expect(result.output.unit).toBe("fahrenheit");
    expect(result.input).toEqual({ value: 100, unit: "celsius" });
  });

  test("converts Fahrenheit to Celsius", async () => {
    const result = await execute({ value: 32, from: "fahrenheit", to: "celsius" });
    expect(result.output.value).toBeCloseTo(0, 5);
    expect(result.output.unit).toBe("celsius");
  });

  test("converts Celsius to Kelvin", async () => {
    const result = await execute({ value: 0, from: "celsius", to: "kelvin" });
    expect(result.output.value).toBeCloseTo(273.15, 5);
    expect(result.output.unit).toBe("kelvin");
  });

  test("converts Kelvin to Celsius", async () => {
    const result = await execute({ value: 273.15, from: "kelvin", to: "celsius" });
    expect(result.output.value).toBeCloseTo(0, 5);
    expect(result.output.unit).toBe("celsius");
  });

  test("converts Kelvin to Fahrenheit", async () => {
    const result = await execute({ value: 373.15, from: "kelvin", to: "fahrenheit" });
    expect(result.output.value).toBeCloseTo(212, 4);
    expect(result.output.unit).toBe("fahrenheit");
  });

  test("same-unit conversion returns same value", async () => {
    const result = await execute({ value: 25, from: "celsius", to: "celsius" });
    expect(result.output.value).toBeCloseTo(25, 5);
    expect(result.output.unit).toBe("celsius");
  });

  test("preserves input in result", async () => {
    const result = await execute({ value: 72, from: "fahrenheit", to: "celsius" });
    expect(result.input).toEqual({ value: 72, unit: "fahrenheit" });
  });
});
