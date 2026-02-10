import { randomUUID } from "node:crypto";
import { AgentExecutor, ExecutionEventBus, RequestContext } from "@a2a-js/sdk/server";
import { Message, TextPart } from "@a2a-js/sdk";
import type { ToolLoopAgent, ToolSet } from "ai";

export class ToolLoopAgentExecutor<TOOLS extends ToolSet = ToolSet> implements AgentExecutor {
  constructor(private agent: ToolLoopAgent<never, TOOLS>) {}

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    try {
      // Extract the user's message text
      const userMessage = requestContext.userMessage;
      const textParts = userMessage.parts.filter((part): part is TextPart => part.kind === "text");
      const prompt = textParts.map((part) => part.text).join("\n");

      // TODO(@fuxingloh): supporting streaming later
      const result = await this.agent.generate({ prompt });
      const responseMessage: Message = {
        kind: "message",
        messageId: randomUUID(),
        role: "agent",
        parts: [{ kind: "text", text: result.text }],
        contextId: requestContext.contextId,
      };

      eventBus.publish(responseMessage);
      eventBus.finished();
    } catch (error) {
      // Handle errors by publishing an error message
      const errorMessage: Message = {
        kind: "message",
        messageId: randomUUID(),
        role: "agent",
        parts: [
          {
            kind: "text",
            text: `Error: ${error instanceof Error ? error.message : "An unknown error occurred"}`,
          },
        ],
        contextId: requestContext.contextId,
      };

      eventBus.publish(errorMessage);
      eventBus.finished();
    }
  }

  async cancelTask(_taskId: string, eventBus: ExecutionEventBus): Promise<void> {
    // TODO(@fuxingloh): The ToolLoopAgent doesn't support cancellation, so we just finish
    eventBus.finished();
  }
}
