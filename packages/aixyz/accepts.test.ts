import { describe, expect, test } from "bun:test";
import { isAcceptsPaid } from "./accepts";
import type { Accepts } from "./accepts";

describe("isAcceptsPaid", () => {
  test("returns true for valid exact scheme", () => {
    expect(isAcceptsPaid({ scheme: "exact", price: "$0.01" })).toBe(true);
  });

  test("returns false for free scheme", () => {
    expect(isAcceptsPaid({ scheme: "free" })).toBe(false);
  });

  test("returns true for valid multi-accepts with network", () => {
    expect(
      isAcceptsPaid([
        { scheme: "exact", price: "$0.01", network: "eip155:8453" },
        { scheme: "exact", price: "$0.02", network: "eip155:1" },
      ]),
    ).toBe(true);
  });

  test("returns false for empty array", () => {
    expect(isAcceptsPaid([] as unknown as Accepts)).toBe(false);
  });

  test("returns false for array entries missing network", () => {
    expect(isAcceptsPaid([{ scheme: "exact", price: "$0.01" }] as unknown as Accepts)).toBe(false);
  });

  test("returns false for array with wrong scheme", () => {
    expect(isAcceptsPaid([{ scheme: "invalid", price: "$0.01", network: "eip155:8453" }] as unknown as Accepts)).toBe(
      false,
    );
  });
});
