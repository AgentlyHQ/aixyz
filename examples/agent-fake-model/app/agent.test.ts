import { describe, expect, test } from "bun:test";
import { model } from "./agent";

describe("palindrome checker (fake model)", () => {
  test("detects a palindrome", async () => {
    const result = await model.doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: "racecar" }] }],
    });
    expect(result.content[0].text).toContain("is a palindrome");
  });

  test("reverses a non-palindrome", async () => {
    const result = await model.doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
    });
    expect(result.content[0].text).toContain('"olleh"');
  });

  test("tracks turn number from prompt context", async () => {
    const prompt = [
      { role: "user", content: [{ type: "text", text: "hi" }] },
      { role: "assistant", content: [{ type: "text", text: "..." }] },
      { role: "user", content: [{ type: "text", text: "level" }] },
    ];
    const result = await model.doGenerate({ prompt });
    expect(result.content[0].text).toContain("turn 2");
    expect(result.content[0].text).toContain("is a palindrome");
  });

  test("is deterministic — same input always gives same output", async () => {
    const prompt = [{ role: "user", content: [{ type: "text", text: "world" }] }];
    const r1 = await model.doGenerate({ prompt });
    const r2 = await model.doGenerate({ prompt });
    expect(r1.content[0].text).toBe(r2.content[0].text);
  });

  test("finish reason is stop", async () => {
    const result = await model.doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: "madam" }] }],
    });
    expect(result.finishReason).toBe("stop");
  });
});
