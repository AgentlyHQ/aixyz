export type Prompt = Array<{ role: string; content: Array<{ type: string; text?: string }> }>;

/**
 * Returns the text of the last user message in the prompt, or an empty string if none exists.
 * Searches backward through the prompt array for the last user role entry and returns the first
 * text part found within it.
 */
function lastUserText(prompt: Prompt): string {
  for (let i = prompt.length - 1; i >= 0; i--) {
    if (prompt[i].role === "user") {
      for (const part of prompt[i].content) {
        if (part.type === "text" && part.text) {
          return part.text;
        }
      }
    }
  }
  return "";
}

/**
 * Creates a fake language model for testing and development.
 * Conforms to the LanguageModelV2 v3 specification with zero token usage.
 *
 * The `transform` function receives the last user message text and the full prompt,
 * and returns the model output string.
 *
 * @example
 * import { fake } from "aixyz/model";
 *
 * // custom transform using last message only
 * const helloModel = fake((input) => `hello, ${input}`);
 *
 * // custom transform using full prompt context
 * const contextModel = fake((input, prompt) => `${prompt.length} turns: ${input}`);
 */
export function fake(transform: (lastMessage: string, prompt: Prompt) => string) {
  return {
    specificationVersion: "v3" as const,
    provider: "aixyz/fake",
    modelId: "aixyz/fake",
    supportedUrls: {},
    doGenerate(options: { prompt: Prompt }) {
      const text = transform(lastUserText(options.prompt), options.prompt);
      return Promise.resolve({
        content: [{ type: "text" as const, text }],
        finishReason: "stop" as const,
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 0, text: 0, reasoning: 0 },
        },
        warnings: [],
      });
    },
    doStream(options: { prompt: Prompt }) {
      const text = transform(lastUserText(options.prompt), options.prompt);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "stream-start" as const, warnings: [] });
          controller.enqueue({ type: "text-start" as const, id: "1" });
          controller.enqueue({ type: "text-delta" as const, id: "1", delta: text });
          controller.enqueue({ type: "text-end" as const, id: "1" });
          controller.enqueue({
            type: "finish" as const,
            finishReason: "stop" as const,
            usage: {
              inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 0, text: 0, reasoning: 0 },
            },
          });
          controller.close();
        },
      });
      return Promise.resolve({ stream });
    },
  };
}
