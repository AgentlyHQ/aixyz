import { randomUUID } from "node:crypto";
import {
  AgentExecutor,
  DefaultRequestHandler,
  ExecutionEventBus,
  InMemoryTaskStore,
  RequestContext,
  TaskStore,
} from "@a2a-js/sdk/server";
import { AgentCard, Message, TextPart } from "@a2a-js/sdk";
import type { ToolLoopAgent, ToolSet } from "ai";
import { getAixyzConfig } from "../../config.js";
import { AixyzServer } from "../index.js";
import { agentCardHandler, jsonRpcHandler, UserBuilder } from "@a2a-js/sdk/server/express";
import { Accepts } from "../../accepts.js";

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

export function getAgentCard(): AgentCard {
  const config = getAixyzConfig();
  return {
    name: config.name,
    description: config.description,
    protocolVersion: "0.3.0",
    version: config.version,
    url: new URL("/agent", config.url).toString(),
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: config.skills,
  };
}

export function useA2A<TOOLS extends ToolSet = ToolSet>(
  app: AixyzServer,
  exports: {
    default: ToolLoopAgent<never, TOOLS>;
    accepts?: Accepts;
  },
  taskStore: TaskStore = new InMemoryTaskStore(),
): void {
  if (!exports.accepts) {
    // TODO(@fuxingloh): right now we just don't register the agent if accepts is not provided,
    //  but it might be a better idea to do it in aixyz-cli (aixyz-pack).
    return;
  }

  const agentExecutor = new ToolLoopAgentExecutor(exports.default);
  const requestHandler = new DefaultRequestHandler(getAgentCard(), taskStore, agentExecutor);

  app.express.use(
    "/.well-known/agent-card.json",
    agentCardHandler({
      agentCardProvider: requestHandler,
    }),
  );

  if (exports.accepts.scheme === "exact") {
    app.withX402("POST /agent", exports.accepts);
  }

  app.express.use(
    "/agent",
    jsonRpcHandler({
      requestHandler,
      userBuilder: UserBuilder.noAuthentication,
    }),
  );
}
