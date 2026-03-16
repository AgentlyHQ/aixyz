import { randomUUID } from "node:crypto";
import {
  AgentExecutor,
  DefaultRequestHandler,
  ExecutionEventBus,
  InMemoryTaskStore,
  JsonRpcTransportHandler,
  RequestContext,
  TaskStore,
} from "@a2a-js/sdk/server";
import { AgentCard, Message, Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent, TextPart } from "@a2a-js/sdk";
import type { ToolLoopAgent, ToolSet } from "ai";
import { z } from "zod";
import { getAixyzConfigRuntime } from "../../config";
import { BasePlugin } from "../plugin";
import type { AixyzApp } from "../index";
import { Accepts, AcceptsScheme } from "../../accepts";

export const CapabilitiesSchema = z.object({
  streaming: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  stateTransitionHistory: z.boolean().optional(),
});

export type Capabilities = z.infer<typeof CapabilitiesSchema>;

const DEFAULT_CAPABILITIES: Capabilities = { streaming: true, pushNotifications: false };

/**
 * Wraps a Vercel AI SDK ToolLoopAgent into the A2A AgentExecutor interface.
 * Streams text chunks as artifact updates and publishes task lifecycle events.
 */
export class ToolLoopAgentExecutor<TOOLS extends ToolSet = ToolSet> implements AgentExecutor {
  constructor(
    private agent: ToolLoopAgent<never, TOOLS>,
    private streaming = true,
  ) {}

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { taskId, contextId, userMessage, task } = requestContext;
    try {
      const textParts = userMessage.parts.filter((part): part is TextPart => part.kind === "text");
      const prompt = textParts.map((part) => part.text).join("\n");

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

      const workingUpdate: TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId,
        contextId,
        status: { state: "working", timestamp: new Date().toISOString() },
        final: false,
      };
      eventBus.publish(workingUpdate);

      const artifactId = randomUUID();

      if (this.streaming) {
        const result = await this.agent.stream({ prompt });
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
      } else {
        const result = await this.agent.generate({ prompt });
        const artifactUpdate: TaskArtifactUpdateEvent = {
          kind: "artifact-update",
          taskId,
          contextId,
          artifact: {
            artifactId,
            parts: [{ kind: "text", text: result.text }],
          },
          append: false,
        };
        eventBus.publish(artifactUpdate);
      }

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
    eventBus.finished();
  }
}

/** Build an A2A AgentCard from the runtime config, pointing to the given agent endpoint path. */
export function getAgentCard(agentPath = "/agent", capabilities?: Capabilities): AgentCard {
  const config = getAixyzConfigRuntime();
  return {
    name: config.name,
    description: config.description,
    protocolVersion: "0.3.0",
    version: config.version,
    url: new URL(agentPath, config.url).toString(),
    capabilities: { ...DEFAULT_CAPABILITIES, ...capabilities },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: config.skills,
  };
}

/**
 * A2A protocol plugin. Registers the well-known agent card endpoint
 * and a JSON-RPC endpoint that delegates to the given ToolLoopAgent.
 * Routes are only registered if the agent exports a valid `accepts` payment config.
 */
export class A2APlugin<TOOLS extends ToolSet = ToolSet> extends BasePlugin {
  readonly name = "a2a";

  constructor(
    private exports: { default: ToolLoopAgent<never, TOOLS>; accepts?: Accepts; capabilities?: Capabilities },
    private prefix?: string,
    private taskStore: TaskStore = new InMemoryTaskStore(),
  ) {
    super();
  }

  register(app: AixyzApp): void {
    if (this.exports.accepts) {
      AcceptsScheme.parse(this.exports.accepts);
    } else {
      return;
    }

    const parsed = this.exports.capabilities ? CapabilitiesSchema.safeParse(this.exports.capabilities) : undefined;
    const capabilities = parsed?.success ? { ...DEFAULT_CAPABILITIES, ...parsed.data } : DEFAULT_CAPABILITIES;

    const agentPath: `/${string}` = this.prefix ? `/${this.prefix}/agent` : "/agent";
    const wellKnownPath: `/${string}` = this.prefix
      ? `/${this.prefix}/.well-known/agent-card.json`
      : "/.well-known/agent-card.json";

    const agentExecutor = new ToolLoopAgentExecutor(this.exports.default, capabilities.streaming ?? true);
    const requestHandler = new DefaultRequestHandler(
      getAgentCard(agentPath, capabilities),
      this.taskStore,
      agentExecutor,
    );
    const jsonRpcTransport = new JsonRpcTransportHandler(requestHandler);

    // Agent card — pure web-standard handler
    app.route("GET", wellKnownPath, async () => {
      const card = await requestHandler.getAgentCard();
      return Response.json(card);
    });

    // JSON-RPC endpoint — pure web-standard handler using JsonRpcTransportHandler
    app.route(
      "POST",
      agentPath,
      async (request: Request) => {
        const body = await request.json();
        const result = await jsonRpcTransport.handle(body);

        // If result is an AsyncGenerator (streaming), return as SSE
        if (Symbol.asyncIterator in Object(result)) {
          const stream = result as AsyncGenerator;
          const readable = new ReadableStream({
            async start(controller) {
              const encoder = new TextEncoder();
              try {
                for await (const event of stream) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
                }
              } catch (error) {
                const errorResponse = {
                  jsonrpc: "2.0",
                  id: body?.id || null,
                  error: {
                    code: -32603,
                    message: error instanceof Error ? error.message : "Streaming error.",
                  },
                };
                controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(errorResponse)}\n\n`));
              } finally {
                controller.close();
              }
            },
          });
          return new Response(readable, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
              "X-Accel-Buffering": "no",
            },
          });
        }

        return Response.json(result);
      },
      {
        payment: this.exports.accepts.scheme === "exact" ? this.exports.accepts : undefined,
      },
    );
  }
}
