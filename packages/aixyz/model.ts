import { MockLanguageModelV3 } from "ai/test";
import type { LanguageModelV3CallOptions, LanguageModelV3Prompt } from "@ai-sdk/provider";

export type Prompt = LanguageModelV3Prompt;

/**
 * Returns the text of the last user message in the prompt, or an empty string if none exists.
 * Searches backward through the prompt array for the last user role entry and returns the first
 * text part found within it.
 */
function lastUserText(prompt: Prompt): string {
  for (let i = prompt.length - 1; i >= 0; i--) {
    const message = prompt[i];
    if (message.role === "user") {
      for (const part of message.content) {
        if (part.type === "text" && part.text) {
          return part.text;
        }
      }
    }
  }
  return "";
}

/**
 * Creates a fake language model for testing and development, backed by `MockLanguageModelV3`.
 * Conforms to the LanguageModelV3 specification with zero token usage.
 *
 * The `transform` function receives the last user message text and the full prompt,
 * and returns the model output string.
 *
 * All calls are recorded in `.doGenerateCalls` and `.doStreamCalls` for test assertions.
 *
 * @example
 * import { fake } from "aixyz/model";
 *
 * // custom transform using last message only
 * const helloModel = fake((input) => `hello, ${input}`);
 *
 * // inspect recorded calls after use
 * await helloModel.doGenerate({ prompt });
 * console.log(helloModel.doGenerateCalls.length); // 1
 *
 * // custom transform using full prompt context
 * const contextModel = fake((input, prompt) => `${prompt.length} turns: ${input}`);
 */
export function fake(transform: (lastMessage: string, prompt: Prompt) => string): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    provider: "aixyz/fake",
    modelId: "aixyz/fake",
    doGenerate: async (options: LanguageModelV3CallOptions) => {
      const text = transform(lastUserText(options.prompt), options.prompt);
      return {
        content: [{ type: "text" as const, text }],
        finishReason: { unified: "stop" as const, raw: undefined },
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 0, text: 0, reasoning: 0 },
        },
        warnings: [],
      };
    },
    doStream: async (options: LanguageModelV3CallOptions) => {
      const text = transform(lastUserText(options.prompt), options.prompt);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "stream-start" as const, warnings: [] });
          controller.enqueue({ type: "text-start" as const, id: "1" });
          controller.enqueue({ type: "text-delta" as const, id: "1", delta: text });
          controller.enqueue({ type: "text-end" as const, id: "1" });
          controller.enqueue({
            type: "finish" as const,
            finishReason: { unified: "stop" as const, raw: undefined },
            usage: {
              inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 0, text: 0, reasoning: 0 },
            },
          });
          controller.close();
        },
      });
      return { stream };
    },
  });
}
