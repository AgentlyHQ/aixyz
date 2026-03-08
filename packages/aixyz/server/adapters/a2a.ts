import { randomUUID } from "node:crypto";
import {
  AgentExecutor,
  DefaultRequestHandler,
  ExecutionEventBus,
  InMemoryTaskStore,
  JsonRpcTransportHandler,
  RequestContext,
  ServerCallContext,
  TaskStore,
  UnauthenticatedUser,
} from "@a2a-js/sdk/server";
import { AgentCard, Message, Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent, TextPart } from "@a2a-js/sdk";
import type { ToolLoopAgent, ToolSet } from "ai";
import { getAixyzConfigRuntime } from "../../config";
import { AixyzServer } from "../index";
import { Accepts, AcceptsScheme } from "../../accepts";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

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

export function getAgentCard(agentPath = "/agent"): AgentCard {
  const config = getAixyzConfigRuntime();
  return {
    name: config.name,
    description: config.description,
    protocolVersion: "0.3.0",
    version: config.version,
    url: new URL(agentPath, config.url).toString(),
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
  prefix?: string,
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

  const agentPath: `/${string}` = prefix ? `/${prefix}/agent` : "/agent";
  const wellKnownPath: `/${string}` = prefix
    ? `/${prefix}/.well-known/agent-card.json`
    : "/.well-known/agent-card.json";

  const agentExecutor = new ToolLoopAgentExecutor(exports.default);
  const requestHandler = new DefaultRequestHandler(getAgentCard(agentPath), taskStore, agentExecutor);
  const jsonRpcTransportHandler = new JsonRpcTransportHandler(requestHandler);

  // GET /.well-known/agent-card.json – agent discovery
  app.on("GET", wellKnownPath, async () => {
    const card = await requestHandler.getAgentCard();
    return Response.json(card);
  });

  if (exports.accepts.scheme === "exact") {
    app.withX402Exact(`POST ${agentPath}`, exports.accepts);
  }

  // POST /agent – JSON-RPC endpoint (supports both non-streaming and SSE streaming)
  app.on("POST", agentPath, async (req) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const context = new ServerCallContext(undefined, new UnauthenticatedUser());
    const result = await jsonRpcTransportHandler.handle(body, context);

    if (result !== null && typeof result === "object" && Symbol.asyncIterator in result) {
      // SSE streaming response
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of result as AsyncGenerator<unknown>) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            }
          } catch (err) {
            const errorEvent = {
              jsonrpc: "2.0",
              id: (body as any)?.id ?? null,
              error: { code: -32603, message: err instanceof Error ? err.message : "Streaming error" },
            };
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`));
          } finally {
            controller.close();
          }
        },
      });
      return new Response(stream, { headers: SSE_HEADERS });
    }

    return Response.json(result);
  });
}
