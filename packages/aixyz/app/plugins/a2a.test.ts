import { afterAll, beforeAll, describe, expect, mock, test, setDefaultTimeout } from "bun:test";
import { createFixture, type X402Fixture } from "../../test/x402-fixture";
import { sendA2AMessage, getA2ACard, DryRunPaymentRequired, PayTransaction } from "@use-agently/sdk";

setDefaultTimeout(30_000);

let testPayTo = "0x0000000000000000000000000000000000000000";
let testUrl = "http://localhost:3000";

// Mock config before any imports that depend on it
mock.module("@aixyz/config", () => ({
  getAixyzConfig: () => ({
    name: "Test Agent",
    description: "A test agent",
    version: "1.0.0",
    url: testUrl,
    x402: { payTo: testPayTo, network: "eip155:8453" },
    build: { tools: [], agents: [], excludes: [], poweredByHeader: true },
    skills: [{ id: "test-skill", name: "Test Skill", description: "Does testing", tags: ["test"] }],
  }),
  getAixyzConfigRuntime: () => ({
    name: "Test Agent",
    description: "A test agent",
    version: "1.0.0",
    url: testUrl,
    skills: [{ id: "test-skill", name: "Test Skill", description: "Does testing", tags: ["test"] }],
  }),
}));

import { ToolLoopAgentExecutor, A2APlugin, getAgentCard, CapabilitiesSchema } from "./a2a";
import { AixyzApp } from "../index";
import type { ToolLoopAgent } from "ai";
import { DefaultExecutionEventBus } from "@a2a-js/sdk/server";
import type { AgentExecutionEvent } from "@a2a-js/sdk/server";
import type { Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent } from "@a2a-js/sdk";
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

function makeMockAgent(chunks: string[] = ["Hello", " world"]): ToolLoopAgent<never> {
  return {
    stream: async () => ({ textStream: makeAsyncIterable(chunks) }),
  } as unknown as ToolLoopAgent<never>;
}

/** Spin up a real Bun server with an A2APlugin-backed AixyzApp. */
function createServer(
  agent: ToolLoopAgent<never> = makeMockAgent(),
  accepts: { scheme: "free" } | { scheme: "exact"; price: string } = { scheme: "free" },
  prefix?: string,
  capabilities?: { streaming?: boolean; pushNotifications?: boolean; stateTransitionHistory?: boolean },
) {
  const server = Bun.serve({ port: 0, fetch: () => new Response("") });
  const url = `http://localhost:${server.port}`;
  const prevUrl = testUrl;
  testUrl = url;
  const app = new AixyzApp();
  new A2APlugin({ default: agent, accepts, capabilities }, prefix).register(app);
  server.reload({ fetch: app.fetch.bind(app) });
  testUrl = prevUrl;
  return { server, url, app };
}

let fixture: X402Fixture;

beforeAll(async () => {
  fixture = await createFixture();
  testPayTo = fixture.payTo;
}, 120_000);

afterAll(async () => {
  await fixture.close();
}, 30_000);

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

  test("non-streaming executor uses generate and publishes single artifact", async () => {
    const STREAMING = false;
    const mockAgent = {
      generate: async () => ({ text: "Hello world" }),
      stream: async () => {
        throw new Error("stream should not be called");
      },
    } as unknown as ToolLoopAgent<never>;

    const executor = new ToolLoopAgentExecutor(mockAgent, STREAMING);
    const eventBus = new DefaultExecutionEventBus();
    const events: AgentExecutionEvent[] = [];
    eventBus.on("event", (event) => events.push(event));

    await executor.execute(makeRequestContext(), eventBus);

    const initialTask = events[0] as Task;
    expect(initialTask.kind).toBe("task");
    expect(initialTask.status.state).toBe("submitted");

    const workingUpdate = events[1] as TaskStatusUpdateEvent;
    expect(workingUpdate.status.state).toBe("working");

    const artifactUpdate = events[2] as TaskArtifactUpdateEvent;
    expect(artifactUpdate.kind).toBe("artifact-update");
    expect(artifactUpdate.artifact.parts[0]).toEqual({ kind: "text", text: "Hello world" });
    expect(artifactUpdate.append).toBe(false);

    const completedUpdate = events[3] as TaskStatusUpdateEvent;
    expect(completedUpdate.status.state).toBe("completed");
    expect(completedUpdate.final).toBe(true);
  });

  test("publishes error message when generate throws in non-streaming mode", async () => {
    const STREAMING = false;
    const failingAgent = {
      generate: async () => {
        throw new Error("generate failed");
      },
    } as unknown as ToolLoopAgent<never>;

    const executor = new ToolLoopAgentExecutor(failingAgent, STREAMING);
    const eventBus = new DefaultExecutionEventBus();
    const events: AgentExecutionEvent[] = [];
    eventBus.on("event", (event) => events.push(event));

    await executor.execute(makeRequestContext(), eventBus);

    expect(events.length).toBe(3);
    const errorMsg = events[2] as any;
    expect(errorMsg.kind).toBe("message");
    expect(errorMsg.parts[0].text).toContain("generate failed");
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

  test("uses default capabilities when none provided", () => {
    const card = getAgentCard();
    expect(card.capabilities).toEqual({ streaming: true, pushNotifications: false });
  });

  test("uses custom capabilities when provided", () => {
    const card = getAgentCard("/agent", { streaming: false, pushNotifications: true });
    expect(card.capabilities).toEqual({ streaming: false, pushNotifications: true });
  });
});

describe("CapabilitiesSchema", () => {
  test("accepts valid capabilities", () => {
    const result = CapabilitiesSchema.parse({ streaming: true, pushNotifications: false });
    expect(result).toEqual({ streaming: true, pushNotifications: false });
  });

  test("accepts partial capabilities", () => {
    const result = CapabilitiesSchema.parse({ streaming: false });
    expect(result).toEqual({ streaming: false });
  });

  test("accepts empty object", () => {
    const result = CapabilitiesSchema.parse({});
    expect(result).toEqual({});
  });

  test("rejects invalid types", () => {
    const result = CapabilitiesSchema.safeParse({ streaming: "yes" });
    expect(result.success).toBe(false);
  });
});

describe("A2APlugin", () => {
  let mainServer: ReturnType<typeof Bun.serve>;
  let mainUrl: string;
  let prefixedServer: ReturnType<typeof Bun.serve>;
  let prefixedUrl: string;

  beforeAll(() => {
    const main = createServer();
    mainServer = main.server;
    mainUrl = main.url;

    const prefixed = createServer(makeMockAgent(), { scheme: "free" }, "v1");
    prefixedServer = prefixed.server;
    prefixedUrl = prefixed.url;
  });

  afterAll(() => {
    mainServer?.stop(true);
    prefixedServer?.stop(true);
  });

  describe("route registration", () => {
    test("registers GET well-known and POST agent routes", () => {
      const app = new AixyzApp();
      new A2APlugin({ default: makeMockAgent(), accepts: { scheme: "free" } }).register(app);
      expect(app.routes.has("GET /.well-known/agent-card.json")).toBe(true);
      expect(app.routes.has("POST /agent")).toBe(true);
    });

    test("skips registration when no accepts", () => {
      const app = new AixyzApp();
      new A2APlugin({ default: makeMockAgent() }).register(app);
      expect(app.routes.size).toBe(0);
    });

    test("registers routes with custom prefix", () => {
      const app = new AixyzApp();
      new A2APlugin({ default: makeMockAgent(), accepts: { scheme: "free" } }, "v1").register(app);
      expect(app.routes.has("GET /v1/.well-known/agent-card.json")).toBe(true);
      expect(app.routes.has("POST /v1/agent")).toBe(true);
    });
  });

  describe("agent card", () => {
    test("getA2ACard returns agent card with config values", async () => {
      const card = await getA2ACard(mainUrl);

      expect(card.name).toBe("Test Agent");
      expect(card.description).toBe("A test agent");
      expect(card.version).toBe("1.0.0");
      expect(card.protocolVersion).toBe("0.3.0");
      expect(card.capabilities.streaming).toBe(true);
      expect(card.skills).toHaveLength(1);
      expect(card.skills![0]).toMatchObject({
        id: "test-skill",
        name: "Test Skill",
        description: "Does testing",
        tags: ["test"],
      });
    });

    test("getA2ACard falls back to defaults for invalid capabilities", async () => {
      const { server, url } = createServer(makeMockAgent(), { scheme: "free" }, undefined, { streaming: "yes" } as any);
      try {
        const card = await getA2ACard(url);
        expect(card.capabilities.streaming).toBe(true);
        expect(card.capabilities.pushNotifications).toBe(false);
      } finally {
        server.stop(true);
      }
    });

    test("getA2ACard reflects custom capabilities", async () => {
      const { server, url } = createServer(makeMockAgent(), { scheme: "free" }, undefined, {
        streaming: false,
        pushNotifications: true,
      });
      try {
        const card = await getA2ACard(url);
        expect(card.capabilities.streaming).toBe(false);
        expect(card.capabilities.pushNotifications).toBe(true);
      } finally {
        server.stop(true);
      }
    });

    test("getA2ACard works with prefixed well-known path", async () => {
      const res = await fetch(`${prefixedUrl}/v1/.well-known/agent-card.json`);
      expect(res.status).toBe(200);
      const card = await res.json();
      expect(card.name).toBe("Test Agent");
      expect(card.url).toBe(`${prefixedUrl}/v1/agent`);
    });
  });

  describe("message/send", () => {
    test("sendA2AMessage returns agent text", async () => {
      const result = await sendA2AMessage(mainUrl, "greet me");
      expect(result.text).toContain("Hello");
      expect(result.text).toContain("world");
    });

    test("sendA2AMessage with prefixed agent works", async () => {
      const res = await fetch(`${prefixedUrl}/v1/agent`, {
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
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.result.status.state).toBe("completed");
    });

    test("sendA2AMessage with agent error still returns result", async () => {
      const failingAgent = {
        stream: async () => {
          throw new Error("agent exploded");
        },
      } as unknown as ToolLoopAgent<never>;
      const { server, url } = createServer(failingAgent);
      try {
        const result = await sendA2AMessage(url, "fail");
        expect(result.text).toBeDefined();
      } finally {
        server.stop(true);
      }
    });
  });

  describe("message/stream", () => {
    test("message/stream returns collected result", async () => {
      const res = await fetch(`${mainUrl}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "message/stream",
          params: {
            message: {
              kind: "message",
              messageId: "msg-1",
              role: "user",
              parts: [{ kind: "text", text: "stream test" }],
            },
          },
        }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.jsonrpc).toBe("2.0");
      expect(json.id).toBe(1);
      expect(json.result).toBeDefined();
    });
  });

  describe("tasks/get", () => {
    test("tasks/get for unknown task returns JSON-RPC error", async () => {
      const res = await fetch(`${mainUrl}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 5, method: "tasks/get", params: { id: "nonexistent-task" } }),
      });
      const json = await res.json();
      expect(json.jsonrpc).toBe("2.0");
      expect(json.id).toBe(5);
      expect(json.error).toBeDefined();
    });

    test("tasks/get returns task after sendA2AMessage", async () => {
      const result = await sendA2AMessage(mainUrl, "test");
      const taskId = (result.raw as any).id;

      const res = await fetch(`${mainUrl}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tasks/get", params: { id: taskId } }),
      });
      const json = await res.json();
      expect(json.jsonrpc).toBe("2.0");
      expect(json.id).toBe(2);
      expect(json.result.id).toBe(taskId);
      expect(json.result.status.state).toBe("completed");
    });
  });

  describe("JSON-RPC edge cases", () => {
    test("unknown JSON-RPC method returns method-not-found error", async () => {
      const res = await fetch(`${mainUrl}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 10, method: "nonexistent/method", params: {} }),
      });
      const json = await res.json();
      expect(json.jsonrpc).toBe("2.0");
      expect(json.id).toBe(10);
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe(-32601);
    });

    test("invalid JSON-RPC request returns error", async () => {
      const res = await fetch(`${mainUrl}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ not: "jsonrpc" }),
      });
      const json = await res.json();
      expect(json.error).toBeDefined();
    });
  });

  describe("unregistered routes", () => {
    test("GET /agent returns 404 (only POST registered)", async () => {
      const res = await fetch(`${mainUrl}/agent`);
      expect(res.status).toBe(404);
    });

    test("POST /.well-known/agent-card.json returns 404 (only GET registered)", async () => {
      const res = await fetch(`${mainUrl}/.well-known/agent-card.json`, {
        method: "POST",
        body: "{}",
      });
      expect(res.status).toBe(404);
    });
  });
});

describe("A2APlugin x402 payment", () => {
  let paidUrl: string;
  let stopPaidServer: () => void;

  let freeUrl: string;
  let stopFreeServer: () => void;

  // A2A embeds the server URL in the agent card, so we must allocate the port
  // before building the app (fixture.serve() allocates after, which breaks the card URL).
  function createX402Server(accepts: { scheme: "free" } | { scheme: "exact"; price: string }): {
    url: string;
    stop: () => void;
    app: AixyzApp;
  } {
    const server = Bun.serve({ port: 0, fetch: () => new Response("") });
    const url = `http://localhost:${server.port}`;
    const prevUrl = testUrl;
    testUrl = url;
    const app = new AixyzApp({ facilitators: fixture.facilitator });
    new A2APlugin({ default: makeMockAgent(), accepts }).register(app);
    server.reload({ fetch: app.fetch.bind(app) });
    testUrl = prevUrl;
    return { url, stop: () => server.stop(true), app };
  }

  beforeAll(async () => {
    const paid = createX402Server({ scheme: "exact" as const, price: "$0.01" });
    paidUrl = paid.url;
    stopPaidServer = paid.stop;
    await paid.app.initialize();

    const free = createX402Server({ scheme: "free" as const });
    freeUrl = free.url;
    stopFreeServer = free.stop;
    await free.app.initialize();
  });

  afterAll(() => {
    stopPaidServer?.();
    stopFreeServer?.();
  });

  test("getA2ACard does not require payment", async () => {
    const card = await getA2ACard(paidUrl);
    expect(card.name).toBe("Test Agent");
    expect(card.protocolVersion).toBe("0.3.0");
  });

  test("paid agent without payment throws DryRunPaymentRequired", async () => {
    try {
      await sendA2AMessage(paidUrl, "hello");
      expect.unreachable("expected DryRunPaymentRequired");
    } catch (e) {
      expect(e).toBeInstanceOf(DryRunPaymentRequired);
      expect((e as DryRunPaymentRequired).requirements).toStrictEqual([
        expect.objectContaining({ scheme: "exact", network: "eip155:8453", payTo: fixture.payTo, amount: "10000" }),
      ]);
    }
  });

  test("paid agent with valid payment succeeds", async () => {
    const result = await sendA2AMessage(paidUrl, "hello", { transaction: PayTransaction(fixture.wallet) });
    expect(result.text).toContain("Hello");
    expect(result.text).toContain("world");
  }, 30_000);

  test("free agent does not require payment", async () => {
    const result = await sendA2AMessage(freeUrl, "hello");
    expect(result.text).toContain("Hello");
    expect(result.text).toContain("world");
  });
});
