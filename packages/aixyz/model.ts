/**
 * Returns the text of the last user message in the prompt, or an empty string if none exists.
 * Searches backward through the prompt array for the last user role entry and returns the first
 * text part found within it.
 */
function lastUserText(prompt: Array<{ role: string; content: Array<{ type: string; text?: string }> }>): string {
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
 * A fake language model for testing and development that echoes back the last user message.
 * Conforms to the LanguageModelV2 v3 specification with zero token usage.
 * Import via `import { fake } from "aixyz/model"`.
 */
export const fake = {
  specificationVersion: "v3" as const,
  provider: "aixyz/fake",
  modelId: "aixyz/echo",
  supportedUrls: {},
  doGenerate(options: { prompt: Array<{ role: string; content: Array<{ type: string; text?: string }> }> }) {
    const text = lastUserText(options.prompt);
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
  doStream(options: { prompt: Array<{ role: string; content: Array<{ type: string; text?: string }> }> }) {
    const text = lastUserText(options.prompt);
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
