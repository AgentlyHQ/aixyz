import { describe, expect, test } from "bun:test";
import { createTxtPlan } from "./putTxt";

const DAY = 24 * 60 * 60 * 1000;

describe("createTxtPlan", () => {
  test("generates a uuid hex id with default folder and ttl", () => {
    const now = new Date("2024-01-01T00:00:00.000Z");
    const plan = createTxtPlan({ now });

    expect(plan.id).toMatch(/^[0-9a-f]{32}$/);
    expect(plan.path).toBe(`txt/${plan.id}.txt`);
    expect(plan.createdAt.toISOString()).toBe(now.toISOString());
    expect(plan.expiresAt.toISOString()).toBe(new Date(now.getTime() + 365 * DAY).toISOString());
  });

  test("normalizes folder input and clamps ttl", () => {
    const now = new Date("2024-01-01T00:00:00.000Z");
    const plan = createTxtPlan({ folder: "/logs//events/", expiresInDays: 500, now });

    expect(plan.path).toBe(`logs/events/${plan.id}.txt`);
    expect(plan.expiresAt.toISOString()).toBe(new Date(now.getTime() + 365 * DAY).toISOString());
  });
});
