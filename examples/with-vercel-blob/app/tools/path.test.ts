import { describe, expect, test } from "bun:test";
import { buildTxtPath } from "./put-text";

describe("buildTxtPath", () => {
  test("uses default txt folder and uuid hex id", () => {
    const { id, path } = buildTxtPath();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(path).toBe(`txt/${id}.txt`);
  });

  test("normalizes custom folder", () => {
    const { id, path } = buildTxtPath("/logs//events/");
    expect(path).toBe(`logs/events/${id}.txt`);
  });
});
