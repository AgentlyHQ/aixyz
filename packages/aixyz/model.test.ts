import { describe, expect, test } from "bun:test";
import { fake, type Prompt } from "./model";

const makeUserPrompt = (text: string) => [{ role: "user", content: [{ type: "text", text }] }];

const identity = (input: string) => input;

describe("fake model", () => {
  test("has correct metadata", () => {
    const model = fake(identity);
    expect(model.specificationVersion).toBe("v3");
    expect(model.provider).toBe("aixyz/fake");
    expect(model.modelId).toBe("aixyz/fake");
    expect(model.supportedUrls).toEqual({});
  });

  describe("doGenerate", () => {
    test("echoes back the last user text with identity transform", async () => {
      const model = fake(identity);
      const result = await model.doGenerate({ prompt: makeUserPrompt("hello world") });
      expect(result.content).toEqual([{ type: "text", text: "hello world" }]);
      expect(result.finishReason).toBe("stop");
      expect(result.warnings).toEqual([]);
    });

    test("applies custom transform to the last user text", async () => {
      const model = fake((input) => `hello, ${input}`);
      const result = await model.doGenerate({ prompt: makeUserPrompt("world") });
      expect(result.content[0].text).toBe("hello, world");
    });

    test("applies custom transform to the last user message when multiple messages exist", async () => {
      const model = fake((input) => `hello, ${input}`);
      const prompt = [
        { role: "user", content: [{ type: "text", text: "first" }] },
        { role: "assistant", content: [{ type: "text", text: "reply" }] },
        { role: "user", content: [{ type: "text", text: "you" }] },
      ];
      const result = await model.doGenerate({ prompt });
      expect(result.content[0].text).toBe("hello, you");
    });

    test("passes full prompt as second argument to transform", async () => {
      const model = fake((_input: string, prompt: Prompt) => `${prompt.length} turns`);
      const prompt = [
        { role: "user", content: [{ type: "text", text: "first" }] },
        { role: "assistant", content: [{ type: "text", text: "reply" }] },
        { role: "user", content: [{ type: "text", text: "second" }] },
      ];
      const result = await model.doGenerate({ prompt });
      expect(result.content[0].text).toBe("3 turns");
    });

    test("returns zero usage", async () => {
      const model = fake(identity);
      const result = await model.doGenerate({ prompt: makeUserPrompt("hi") });
      expect(result.usage.inputTokens.total).toBe(0);
      expect(result.usage.outputTokens.total).toBe(0);
    });

    test("returns empty string when no user message", async () => {
      const model = fake(identity);
      const result = await model.doGenerate({ prompt: [] });
      expect(result.content[0].text).toBe("");
    });
  });

  describe("doStream", () => {
    test("streams back the last user text with identity transform", async () => {
      const model = fake(identity);
      const { stream } = await model.doStream({ prompt: makeUserPrompt("stream me") });
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

    test("applies custom transform when streaming", async () => {
      const model = fake((input) => `hello, ${input}`);
      const { stream } = await model.doStream({ prompt: makeUserPrompt("you") });
      const chunks: unknown[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      expect(chunks[2]).toEqual({ type: "text-delta", id: "1", delta: "hello, you" });
    });

    test("stream contains finish chunk with zero usage", async () => {
      const model = fake(identity);
      const { stream } = await model.doStream({ prompt: makeUserPrompt("hi") });
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
