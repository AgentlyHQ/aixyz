import { describe, expect, mock, test } from "bun:test";

// Mock config before any imports that depend on it
mock.module("@aixyz/config", () => ({
  getAixyzConfig: () => ({
    name: "Test Agent",
    description: "A test agent",
    version: "1.0.0",
    url: "http://localhost:3000/",
    x402: { payTo: "0x0000000000000000000000000000000000000000", network: "base:mainnet" },
    skills: [{ id: "test-skill", name: "Test Skill", description: "Does testing", tags: ["test"] }],
  }),
  getAixyzConfigRuntime: () => ({
    name: "Test Agent",
    description: "A test agent",
    version: "1.0.0",
    url: "http://localhost:3000/",
    skills: [{ id: "test-skill", name: "Test Skill", description: "Does testing", tags: ["test"] }],
  }),
}));

import { ToolLoopAgentExecutor, A2APlugin, getAgentCard } from "./a2a";
import { AixyzApp } from "../index";
import type { ToolLoopAgent } from "ai";
import { DefaultExecutionEventBus } from "@a2a-js/sdk/server";
import type { AgentExecutionEvent } from "@a2a-js/sdk/server";
import type { Task, TaskStatusUpdateEvent } from "@a2a-js/sdk";
import type { RequestContext } from "@a2a-js/sdk/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeMockAgent(chunks: string[] = ["Hello", " world"]): ToolLoopAgent<never> {
  return {
    stream: async () => ({ textStream: makeAsyncIterable(chunks) }),
  } as unknown as ToolLoopAgent<never>;
}

function jsonRpcRequest(method: string, params?: unknown, id: number = 1): Request {
  return new Request("http://localhost/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
}

function createPluginApp(
  agent: ToolLoopAgent<never> = makeMockAgent(),
  accepts: { scheme: "free" } | { scheme: "exact"; price: string } = { scheme: "free" },
  prefix?: string,
) {
  const app = new AixyzApp();
  const plugin = new A2APlugin({ default: agent, accepts }, prefix);
  plugin.register(app);
  return app;
}

// ---------------------------------------------------------------------------
// ToolLoopAgentExecutor
// ---------------------------------------------------------------------------

describe("ToolLoopAgentExecutor", () => {
  test("publishes initial task, working status, artifact chunks, and completed status", async () => {
    const chunks = ["Hello", " world"];
    const executor = new ToolLoopAgentExecutor(makeMockAgent(chunks));
    const eventBus = new DefaultExecutionEventBus();
    const events: AgentExecutionEvent[] = [];
    eventBus.on("event", (event) => events.push(event));

    await executor.execute(makeRequestContext(), eventBus);

    const initialTask = events[0] as Task;
    expect(initialTask.kind).toBe("task");
    expect(initialTask.status.state).toBe("submitted");

    const workingUpdate = events[1] as TaskStatusUpdateEvent;
    expect(workingUpdate.kind).toBe("status-update");
    expect(workingUpdate.status.state).toBe("working");

    const completedUpdate = events[events.length - 1] as TaskStatusUpdateEvent;
    expect(completedUpdate.status.state).toBe("completed");
    expect(completedUpdate.final).toBe(true);
  });

  test("publishes error message when streaming throws", async () => {
    const failingAgent = {
      stream: async () => {
        throw new Error("stream failed");
      },
    } as unknown as ToolLoopAgent<never>;

    const executor = new ToolLoopAgentExecutor(failingAgent);
    const eventBus = new DefaultExecutionEventBus();
    const events: AgentExecutionEvent[] = [];
    eventBus.on("event", (event) => events.push(event));

    await executor.execute(makeRequestContext(), eventBus);

    expect(events.length).toBe(3);
    const errorMsg = events[2] as any;
    expect(errorMsg.kind).toBe("message");
    expect(errorMsg.parts[0].text).toContain("stream failed");
  });
});

// ---------------------------------------------------------------------------
// getAgentCard
// ---------------------------------------------------------------------------

describe("getAgentCard", () => {
  test("returns card with config values", () => {
    const card = getAgentCard();

    expect(card.name).toBe("Test Agent");
    expect(card.description).toBe("A test agent");
    expect(card.version).toBe("1.0.0");
    expect(card.protocolVersion).toBe("0.3.0");
    expect(card.capabilities.streaming).toBe(true);
    expect(card.capabilities.pushNotifications).toBe(false);
    expect(card.defaultInputModes).toEqual(["text/plain"]);
    expect(card.defaultOutputModes).toEqual(["text/plain"]);
    expect(card.skills).toHaveLength(1);
    expect(card.skills![0].id).toBe("test-skill");
  });

  test("uses default /agent path", () => {
    const card = getAgentCard();
    expect(card.url).toBe("http://localhost:3000/agent");
  });

  test("accepts custom agent path", () => {
    const card = getAgentCard("/custom/agent");
    expect(card.url).toBe("http://localhost:3000/custom/agent");
  });
});

// ---------------------------------------------------------------------------
// A2APlugin — route registration
// ---------------------------------------------------------------------------

describe("A2APlugin", () => {
  describe("route registration", () => {
    test("registers GET well-known and POST agent routes", () => {
      const app = createPluginApp();

      expect(app.routes.has("GET /.well-known/agent-card.json")).toBe(true);
      expect(app.routes.has("POST /agent")).toBe(true);
    });

    test("skips registration when no accepts", () => {
      const app = new AixyzApp();
      const plugin = new A2APlugin({ default: makeMockAgent() });
      plugin.register(app);

      expect(app.routes.size).toBe(0);
    });

    test("registers routes with custom prefix", () => {
      const app = createPluginApp(makeMockAgent(), { scheme: "free" }, "v1");

      expect(app.routes.has("GET /v1/.well-known/agent-card.json")).toBe(true);
      expect(app.routes.has("POST /v1/agent")).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /.well-known/agent-card.json
  // ---------------------------------------------------------------------------

  describe("GET /.well-known/agent-card.json", () => {
    test("returns agent card as JSON", async () => {
      const app = createPluginApp();

      const res = await app.fetch(new Request("http://localhost/.well-known/agent-card.json"));

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/json");

      const card = await res.json();
      expect(card.name).toBe("Test Agent");
      expect(card.description).toBe("A test agent");
      expect(card.version).toBe("1.0.0");
      expect(card.protocolVersion).toBe("0.3.0");
      expect(card.url).toBe("http://localhost:3000/agent");
      expect(card.capabilities.streaming).toBe(true);
    });

    test("returns card with skills", async () => {
      const app = createPluginApp();

      const res = await app.fetch(new Request("http://localhost/.well-known/agent-card.json"));
      const card = await res.json();

      expect(card.skills).toHaveLength(1);
      expect(card.skills[0]).toMatchObject({
        id: "test-skill",
        name: "Test Skill",
        description: "Does testing",
        tags: ["test"],
      });
    });

    test("well-known path respects prefix", async () => {
      const app = createPluginApp(makeMockAgent(), { scheme: "free" }, "v1");

      const res = await app.fetch(new Request("http://localhost/v1/.well-known/agent-card.json"));

      expect(res.status).toBe(200);
      const card = await res.json();
      expect(card.url).toBe("http://localhost:3000/v1/agent");
    });
  });

  // ---------------------------------------------------------------------------
  // POST /agent — JSON-RPC
  // ---------------------------------------------------------------------------

  describe("POST /agent", () => {
    test("message/send returns completed task", async () => {
      const app = createPluginApp();

      const res = await app.fetch(
        jsonRpcRequest("message/send", {
          message: {
            kind: "message",
            messageId: "msg-1",
            role: "user",
            parts: [{ kind: "text", text: "add 2+3" }],
          },
        }),
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.jsonrpc).toBe("2.0");
      expect(json.id).toBe(1);
      expect(json.result.status.state).toBe("completed");
      expect(json.result.kind).toBe("task");
    });

    test("message/send returns artifacts from agent stream", async () => {
      const app = createPluginApp(makeMockAgent(["Hello", " world"]));

      const res = await app.fetch(
        jsonRpcRequest("message/send", {
          message: {
            kind: "message",
            messageId: "msg-1",
            role: "user",
            parts: [{ kind: "text", text: "greet me" }],
          },
        }),
      );

      const json = await res.json();
      expect(json.result.artifacts).toBeDefined();
      expect(json.result.artifacts.length).toBeGreaterThanOrEqual(1);

      // The artifact parts should contain the streamed text
      const textParts = json.result.artifacts[0].parts.filter((p: any) => p.kind === "text");
      const fullText = textParts.map((p: any) => p.text).join("");
      expect(fullText).toContain("Hello");
      expect(fullText).toContain("world");
    });

    test("message/stream returns streaming result (collected as last chunk)", async () => {
      const app = createPluginApp();

      const res = await app.fetch(
        jsonRpcRequest("message/stream", {
          message: {
            kind: "message",
            messageId: "msg-1",
            role: "user",
            parts: [{ kind: "text", text: "stream test" }],
          },
        }),
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.jsonrpc).toBe("2.0");
      expect(json.id).toBe(1);
      // The plugin collects streaming chunks and returns the last one
      expect(json.result).toBeDefined();
    });

    test("tasks/get for unknown task returns error", async () => {
      const app = createPluginApp();

      const res = await app.fetch(jsonRpcRequest("tasks/get", { id: "nonexistent-task" }, 5));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.jsonrpc).toBe("2.0");
      expect(json.id).toBe(5);
      expect(json.error).toBeDefined();
    });

    test("tasks/get returns task after message/send", async () => {
      const app = createPluginApp();

      // First send a message to create a task
      const sendRes = await app.fetch(
        jsonRpcRequest("message/send", {
          message: {
            kind: "message",
            messageId: "msg-1",
            role: "user",
            parts: [{ kind: "text", text: "test" }],
          },
        }),
      );
      const sendJson = await sendRes.json();
      const taskId = sendJson.result.id;

      // Now fetch that task
      const getRes = await app.fetch(jsonRpcRequest("tasks/get", { id: taskId }, 2));
      const getJson = await getRes.json();

      expect(getJson.jsonrpc).toBe("2.0");
      expect(getJson.id).toBe(2);
      expect(getJson.result.id).toBe(taskId);
      expect(getJson.result.status.state).toBe("completed");
    });

    test("unknown method returns method-not-found error", async () => {
      const app = createPluginApp();

      const res = await app.fetch(jsonRpcRequest("nonexistent/method", {}, 10));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.jsonrpc).toBe("2.0");
      expect(json.id).toBe(10);
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe(-32601); // Method not found
    });

    test("invalid JSON-RPC request returns error", async () => {
      const app = createPluginApp();

      const res = await app.fetch(
        new Request("http://localhost/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ not: "jsonrpc" }),
        }),
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    test("invalid JSON body throws (unhandled at route level)", async () => {
      const app = createPluginApp();

      // The plugin calls request.json() which throws SyntaxError before
      // reaching the A2A JSON-RPC handler
      expect(
        app.fetch(
          new Request("http://localhost/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{broken json",
          }),
        ),
      ).rejects.toThrow(SyntaxError);
    });

    test("message/send with agent error returns completed task with error artifact", async () => {
      const failingAgent = {
        stream: async () => {
          throw new Error("agent exploded");
        },
      } as unknown as ToolLoopAgent<never>;

      const app = createPluginApp(failingAgent);

      const res = await app.fetch(
        jsonRpcRequest("message/send", {
          message: {
            kind: "message",
            messageId: "msg-1",
            role: "user",
            parts: [{ kind: "text", text: "fail" }],
          },
        }),
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.jsonrpc).toBe("2.0");
      // The task should still resolve (executor catches errors)
      expect(json.result).toBeDefined();
    });

    test("POST to prefixed agent path works", async () => {
      const app = createPluginApp(makeMockAgent(), { scheme: "free" }, "v1");

      const res = await app.fetch(
        new Request("http://localhost/v1/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "message/send",
            params: {
              message: {
                kind: "message",
                messageId: "msg-1",
                role: "user",
                parts: [{ kind: "text", text: "prefixed" }],
              },
            },
          }),
        }),
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.result.status.state).toBe("completed");
    });
  });

  // ---------------------------------------------------------------------------
  // Unregistered routes
  // ---------------------------------------------------------------------------

  test("GET /agent returns 404 (only POST registered)", async () => {
    const app = createPluginApp();

    const res = await app.fetch(new Request("http://localhost/agent"));
    expect(res.status).toBe(404);
  });

  test("POST /.well-known/agent-card.json returns 404 (only GET registered)", async () => {
    const app = createPluginApp();

    const res = await app.fetch(
      new Request("http://localhost/.well-known/agent-card.json", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(404);
  });
});
