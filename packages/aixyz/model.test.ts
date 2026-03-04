import { describe, expect, test } from "bun:test";
import { fake, type Prompt } from "./model";

const makeUserPrompt = (text: string): Prompt => [{ role: "user", content: [{ type: "text", text }] }];

const identity = (input: string) => input;

describe("fake model", () => {
  test("has correct metadata", async () => {
    const model = fake(identity);
    expect(model.specificationVersion).toBe("v3");
    expect(model.provider).toBe("aixyz/fake");
    expect(model.modelId).toBe("aixyz/fake");
    expect(await model.supportedUrls).toEqual({});
  });

  describe("doGenerate", () => {
    test("echoes back the last user text with identity transform", async () => {
      const model = fake(identity);
      const result = await model.doGenerate({ prompt: makeUserPrompt("hello world") });
      expect(result.content).toEqual([{ type: "text", text: "hello world" }]);
      expect(result.finishReason).toEqual({ unified: "stop", raw: undefined });
      expect(result.warnings).toEqual([]);
    });

    test("applies custom transform to the last user text", async () => {
      const model = fake((input) => `hello, ${input}`);
      const result = await model.doGenerate({ prompt: makeUserPrompt("world") });
      expect(result.content[0]).toEqual({ type: "text", text: "hello, world" });
    });

    test("applies custom transform to the last user message when multiple messages exist", async () => {
      const model = fake((input) => `hello, ${input}`);
      const prompt: Prompt = [
        { role: "user", content: [{ type: "text", text: "first" }] },
        { role: "assistant", content: [{ type: "text", text: "reply" }] },
        { role: "user", content: [{ type: "text", text: "you" }] },
      ];
      const result = await model.doGenerate({ prompt });
      expect(result.content[0]).toEqual({ type: "text", text: "hello, you" });
    });

    test("passes full prompt as second argument to transform", async () => {
      const model = fake((_input: string, prompt: Prompt) => `${prompt.length} turns`);
      const prompt: Prompt = [
        { role: "user", content: [{ type: "text", text: "first" }] },
        { role: "assistant", content: [{ type: "text", text: "reply" }] },
        { role: "user", content: [{ type: "text", text: "second" }] },
      ];
      const result = await model.doGenerate({ prompt });
      expect(result.content[0]).toEqual({ type: "text", text: "3 turns" });
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
      expect(result.content[0]).toEqual({ type: "text", text: "" });
    });
  });

  describe("doStream", () => {
    async function collectStream(stream: ReadableStream): Promise<unknown[]> {
      const reader = stream.getReader();
      const chunks: unknown[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      return chunks;
    }

    test("streams back the last user text with identity transform", async () => {
      const model = fake(identity);
      const { stream } = await model.doStream({ prompt: makeUserPrompt("stream me") });
      const chunks = await collectStream(stream);
      expect(chunks[0]).toEqual({ type: "stream-start", warnings: [] });
      expect(chunks[1]).toEqual({ type: "text-start", id: "1" });
      expect(chunks[2]).toEqual({ type: "text-delta", id: "1", delta: "stream me" });
      expect(chunks[3]).toEqual({ type: "text-end", id: "1" });
      expect((chunks[4] as { type: string; finishReason: unknown }).finishReason).toEqual({
        unified: "stop",
        raw: undefined,
      });
    });

    test("applies custom transform when streaming", async () => {
      const model = fake((input) => `hello, ${input}`);
      const { stream } = await model.doStream({ prompt: makeUserPrompt("you") });
      const chunks = await collectStream(stream);
      expect(chunks[2]).toEqual({ type: "text-delta", id: "1", delta: "hello, you" });
    });

    test("stream contains finish chunk with zero usage", async () => {
      const model = fake(identity);
      const { stream } = await model.doStream({ prompt: makeUserPrompt("hi") });
      const chunks = await collectStream(stream);
      const finish = chunks[4] as { type: string; usage: { inputTokens: { total: number } } };
      expect(finish.type).toBe("finish");
      expect(finish.usage.inputTokens.total).toBe(0);
    });
  });

  describe("call recording", () => {
    test("records doGenerate calls", async () => {
      const model = fake(identity);
      const prompt = makeUserPrompt("hi");
      await model.doGenerate({ prompt });
      expect(model.doGenerateCalls).toHaveLength(1);
      expect(model.doGenerateCalls[0].prompt).toEqual(prompt);
    });

    test("records multiple doGenerate calls", async () => {
      const model = fake(identity);
      await model.doGenerate({ prompt: makeUserPrompt("first") });
      await model.doGenerate({ prompt: makeUserPrompt("second") });
      expect(model.doGenerateCalls).toHaveLength(2);
    });

    test("records doStream calls", async () => {
      const model = fake(identity);
      const prompt = makeUserPrompt("stream me");
      await model.doStream({ prompt });
      expect(model.doStreamCalls).toHaveLength(1);
      expect(model.doStreamCalls[0].prompt).toEqual(prompt);
    });
  });
});
