import { describe, expect, test } from "bun:test";
import { fake } from "./model";

const makeUserPrompt = (text: string) => [{ role: "user", content: [{ type: "text", text }] }];

describe("fake model", () => {
  test("has correct metadata", () => {
    expect(fake.specificationVersion).toBe("v3");
    expect(fake.provider).toBe("aixyz/fake");
    expect(fake.modelId).toBe("aixyz/echo");
    expect(fake.supportedUrls).toEqual({});
  });

  describe("doGenerate", () => {
    test("echoes back the last user text", async () => {
      const result = await fake.doGenerate({ prompt: makeUserPrompt("hello world") });
      expect(result.content).toEqual([{ type: "text", text: "hello world" }]);
      expect(result.finishReason).toBe("stop");
      expect(result.warnings).toEqual([]);
    });

    test("echoes back the last user message when multiple messages exist", async () => {
      const prompt = [
        { role: "user", content: [{ type: "text", text: "first" }] },
        { role: "assistant", content: [{ type: "text", text: "reply" }] },
        { role: "user", content: [{ type: "text", text: "last" }] },
      ];
      const result = await fake.doGenerate({ prompt });
      expect(result.content[0].text).toBe("last");
    });

    test("returns zero usage", async () => {
      const result = await fake.doGenerate({ prompt: makeUserPrompt("hi") });
      expect(result.usage.inputTokens.total).toBe(0);
      expect(result.usage.outputTokens.total).toBe(0);
    });

    test("returns empty string when no user message", async () => {
      const result = await fake.doGenerate({ prompt: [] });
      expect(result.content[0].text).toBe("");
    });
  });

  describe("doStream", () => {
    test("streams back the last user text", async () => {
      const { stream } = await fake.doStream({ prompt: makeUserPrompt("stream me") });
      const chunks: unknown[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      expect(chunks[0]).toEqual({ type: "stream-start", warnings: [] });
      expect(chunks[1]).toEqual({ type: "text-start", id: "1" });
      expect(chunks[2]).toEqual({ type: "text-delta", id: "1", delta: "stream me" });
      expect(chunks[3]).toEqual({ type: "text-end", id: "1" });
      expect((chunks[4] as { type: string; finishReason: string }).finishReason).toBe("stop");
    });

    test("stream contains finish chunk with zero usage", async () => {
      const { stream } = await fake.doStream({ prompt: makeUserPrompt("hi") });
      const chunks: unknown[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const finish = chunks[4] as { type: string; usage: { inputTokens: { total: number } } };
      expect(finish.type).toBe("finish");
      expect(finish.usage.inputTokens.total).toBe(0);
    });
  });
});
