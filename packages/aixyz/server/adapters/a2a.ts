import { randomUUID } from "node:crypto";
import {
  AgentExecutor,
  DefaultRequestHandler,
  ExecutionEventBus,
  InMemoryTaskStore,
  RequestContext,
  TaskStore,
} from "@a2a-js/sdk/server";
import { AgentCard, Message, Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent, TextPart } from "@a2a-js/sdk";
import type { ToolLoopAgent, ToolSet } from "ai";
import { getAixyzConfigRuntime } from "../../config";
import { AixyzServer } from "../index";
import { agentCardHandler, jsonRpcHandler, UserBuilder } from "@a2a-js/sdk/server/express";
import { Accepts, AcceptsScheme } from "../../accepts";

export class ToolLoopAgentExecutor<TOOLS extends ToolSet = ToolSet> implements AgentExecutor {
  constructor(private agent: ToolLoopAgent<never, TOOLS>) {}

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { taskId, contextId, userMessage, task } = requestContext;
    try {
      // Extract the user's message text
      const textParts = userMessage.parts.filter((part): part is TextPart => part.kind === "text");
      const prompt = textParts.map((part) => part.text).join("\n");

      // Publish the initial Task object if one does not exist yet — required by ResultManager
      // before any TaskArtifactUpdateEvent can be processed.
      if (!task) {
        const initialTask: Task = {
          kind: "task",
          id: taskId,
          contextId,
          status: { state: "submitted", timestamp: new Date().toISOString() },
          history: [userMessage],
        };
        eventBus.publish(initialTask);
      }

      // Signal that the agent is working
      const workingUpdate: TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId,
        contextId,
        status: { state: "working", timestamp: new Date().toISOString() },
        final: false,
      };
      eventBus.publish(workingUpdate);

      // Stream the response and publish artifact chunks as they arrive
      const result = await this.agent.stream({ prompt });
      const artifactId = randomUUID();
      let firstChunk = true;

      for await (const chunk of result.textStream) {
        if (chunk) {
          const artifactUpdate: TaskArtifactUpdateEvent = {
            kind: "artifact-update",
            taskId,
            contextId,
            artifact: {
              artifactId,
              parts: [{ kind: "text", text: chunk }],
            },
            append: !firstChunk,
          };
          eventBus.publish(artifactUpdate);
          firstChunk = false;
        }
      }

      // Publish the final completed status
      const completedUpdate: TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId,
        contextId,
        status: { state: "completed", timestamp: new Date().toISOString() },
        final: true,
      };
      eventBus.publish(completedUpdate);
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
        contextId,
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
  const config = getAixyzConfigRuntime();
  return {
    name: config.name,
    description: config.description,
    protocolVersion: "0.3.0",
    version: config.version,
    url: new URL("/agent", config.url).toString(),
    capabilities: {
      streaming: true,
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
  if (exports.accepts) {
    // TODO(@fuxingloh): validation should be done at build stage
    AcceptsScheme.parse(exports.accepts);
  } else {
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
    app.withX402Exact("POST /agent", exports.accepts);
  }

  app.express.use(
    "/agent",
    jsonRpcHandler({
      requestHandler,
      userBuilder: UserBuilder.noAuthentication,
    }),
  );
}
