import { describe, expect, mock, test } from "bun:test";
import { DefaultExecutionEventBus } from "@a2a-js/sdk/server";
import type { Message, Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent } from "@a2a-js/sdk";
import type { AgentExecutionEvent } from "@a2a-js/sdk/server";
import { ToolLoopAgentExecutor } from "./a2a";
import type { ToolLoopAgent } from "ai";
import type { RequestContext } from "@a2a-js/sdk/server";

function makeRequestContext(overrides?: Partial<RequestContext>): RequestContext {
  return {
    taskId: "task-1",
    contextId: "ctx-1",
    userMessage: {
      kind: "message",
      messageId: "msg-1",
      role: "user",
      parts: [{ kind: "text", text: "Hello!" }],
    },
    task: undefined,
    referenceTasks: undefined,
    context: undefined,
    ...overrides,
  } as unknown as RequestContext;
}

function makeAsyncIterable(chunks: string[]): AsyncIterable<string> {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

describe("ToolLoopAgentExecutor streaming", () => {
  test("publishes initial task, working status, artifact chunks, and completed status when streaming", async () => {
    const chunks = ["Hello", ", ", "world", "!"];
    const mockAgent = {
      stream: mock(async () => ({
        textStream: makeAsyncIterable(chunks),
      })),
    } as unknown as ToolLoopAgent<never>;

    const executor = new ToolLoopAgentExecutor(mockAgent);
    const eventBus = new DefaultExecutionEventBus();

    const events: AgentExecutionEvent[] = [];
    eventBus.on("event", (event) => events.push(event));

    const ctx = makeRequestContext();
    await executor.execute(ctx, eventBus);

    // First event: initial Task object
    const initialTask = events[0] as Task;
    expect(initialTask.kind).toBe("task");
    expect(initialTask.id).toBe("task-1");
    expect(initialTask.contextId).toBe("ctx-1");
    expect(initialTask.status.state).toBe("submitted");

    // Second event: working status
    const workingUpdate = events[1] as TaskStatusUpdateEvent;
    expect(workingUpdate.kind).toBe("status-update");
    expect(workingUpdate.status.state).toBe("working");
    expect(workingUpdate.final).toBe(false);
    expect(workingUpdate.taskId).toBe("task-1");
    expect(workingUpdate.contextId).toBe("ctx-1");

    // Artifact update events (one per non-empty chunk)
    const artifactUpdates = events.slice(2, events.length - 1) as TaskArtifactUpdateEvent[];
    expect(artifactUpdates.length).toBe(chunks.length);
    expect(artifactUpdates[0].kind).toBe("artifact-update");
    expect(artifactUpdates[0].append).toBe(false);
    expect((artifactUpdates[0].artifact.parts[0] as { kind: string; text: string }).text).toBe("Hello");

    // Subsequent chunks should have append: true
    expect(artifactUpdates[1].append).toBe(true);
    expect((artifactUpdates[1].artifact.parts[0] as { kind: string; text: string }).text).toBe(", ");

    // All artifact updates share the same artifactId
    const artifactId = artifactUpdates[0].artifact.artifactId;
    expect(artifactUpdates.every((e) => e.artifact.artifactId === artifactId)).toBe(true);

    // Last event: completed status
    const completedUpdate = events[events.length - 1] as TaskStatusUpdateEvent;
    expect(completedUpdate.kind).toBe("status-update");
    expect(completedUpdate.status.state).toBe("completed");
    expect(completedUpdate.final).toBe(true);
  });

  test("does not publish initial task when task context already exists", async () => {
    const mockAgent = {
      stream: mock(async () => ({
        textStream: makeAsyncIterable(["hi"]),
      })),
    } as unknown as ToolLoopAgent<never>;

    const executor = new ToolLoopAgentExecutor(mockAgent);
    const eventBus = new DefaultExecutionEventBus();

    const events: AgentExecutionEvent[] = [];
    eventBus.on("event", (event) => events.push(event));

    const existingTask: Task = {
      kind: "task",
      id: "task-1",
      contextId: "ctx-1",
      status: { state: "working", timestamp: new Date().toISOString() },
    };
    await executor.execute(makeRequestContext({ task: existingTask }), eventBus);

    // No initial task published; first event is working status
    const first = events[0] as TaskStatusUpdateEvent;
    expect(first.kind).toBe("status-update");
    expect(first.status.state).toBe("working");
  });

  test("skips empty chunks", async () => {
    const mockAgent = {
      stream: mock(async () => ({
        textStream: makeAsyncIterable(["", "content", ""]),
      })),
    } as unknown as ToolLoopAgent<never>;

    const executor = new ToolLoopAgentExecutor(mockAgent);
    const eventBus = new DefaultExecutionEventBus();

    const events: AgentExecutionEvent[] = [];
    eventBus.on("event", (event) => events.push(event));

    await executor.execute(makeRequestContext(), eventBus);

    // initial task + working + 1 artifact ("content") + completed
    expect(events.length).toBe(4);
    const artifact = events[2] as TaskArtifactUpdateEvent;
    expect(artifact.kind).toBe("artifact-update");
    expect((artifact.artifact.parts[0] as { kind: string; text: string }).text).toBe("content");
  });

  test("publishes error message and finishes when streaming throws", async () => {
    const mockAgent = {
      stream: mock(async () => {
        throw new Error("stream failed");
      }),
    } as unknown as ToolLoopAgent<never>;

    const executor = new ToolLoopAgentExecutor(mockAgent);
    const eventBus = new DefaultExecutionEventBus();

    const events: AgentExecutionEvent[] = [];
    eventBus.on("event", (event) => events.push(event));

    await executor.execute(makeRequestContext(), eventBus);

    // initial task + working status + error message
    expect(events.length).toBe(3);
    const errorMsg = events[2] as Message;
    expect(errorMsg.kind).toBe("message");
    expect((errorMsg.parts[0] as { kind: string; text: string }).text).toContain("stream failed");
  });
});
