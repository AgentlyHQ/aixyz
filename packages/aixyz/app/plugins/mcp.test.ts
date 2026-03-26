import { afterAll, beforeAll, describe, expect, mock, test, setDefaultTimeout } from "bun:test";
import { createFixture, type X402Fixture } from "../../test/x402-fixture";
import { callMcpTool, listMcpTools, createDryRunFetch, DryRunPaymentRequired, PayTransaction } from "@use-agently/sdk";

setDefaultTimeout(30_000);

let testPayTo = "0x0000000000000000000000000000000000000000";

mock.module("@aixyz/config", () => ({
  getAixyzConfig: () => ({
    name: "Test Agent",
    description: "A test agent",
    version: "1.0.0",
    url: "http://localhost:3000",
    x402: { payTo: testPayTo, network: "eip155:8453" },
    build: { tools: [], agents: [], excludes: [], poweredByHeader: true },
    vercel: { maxDuration: 30 },
    skills: [],
  }),
  getAixyzConfigRuntime: () => ({
    name: "Test Agent",
    description: "A test agent",
    version: "1.0.0",
    url: "http://localhost:3000",
    skills: [],
  }),
}));

import { AixyzApp } from "../index";
import { MCPPlugin } from "./mcp";

import { tool } from "ai";
import { z } from "zod";

const mockTool = tool({
  description: "Add two numbers",
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  execute: async ({ a, b }) => ({ result: a + b }),
});

const failingTool = tool({
  description: "Always fails",
  inputSchema: z.object({}),
  execute: async () => {
    return new Promise((_, reject) => {
      reject(new Error("broken"));
    });
  },
});

function createApp() {
  return new AixyzApp();
}

function jsonRpcRequest(method: string, params?: unknown, id: number = 1): Request {
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
}

function sseGetRequest(): Request {
  return new Request("http://localhost/mcp", {
    method: "GET",
    headers: { Accept: "text/event-stream" },
  });
}

function deleteRequest(): Request {
  return new Request("http://localhost/mcp", { method: "DELETE" });
}

/** Parse SSE text into an array of {event, data} objects. */
function parseSSEEvents(text: string): Array<{ event?: string; data: string }> {
  const events: Array<{ event?: string; data: string }> = [];
  for (const block of text.split("\n\n").filter(Boolean)) {
    let event: string | undefined;
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7);
      else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
    }
    if (dataLines.length > 0) {
      events.push({ event, data: dataLines.join("\n") });
    }
  }
  return events;
}

/** Extract the JSON-RPC payload from an SSE response. */
async function parseSSEJsonRpc(res: Response): Promise<any> {
  const text = await res.text();
  const events = parseSSEEvents(text);
  const messageEvent = events.find((e) => e.event === "message");
  if (!messageEvent) throw new Error(`No message event in SSE response: ${text}`);
  return JSON.parse(messageEvent.data);
}

const toolEntries = [{ name: "add", exports: { default: mockTool, accepts: { scheme: "free" as const } } }];

const toolEntriesWithFailing = [
  { name: "add", exports: { default: mockTool, accepts: { scheme: "free" as const } } },
  { name: "fail", exports: { default: failingTool, accepts: { scheme: "free" as const } } },
];

const initParams = { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1.0" } };

let fixture: X402Fixture;

beforeAll(async () => {
  fixture = await createFixture();
  testPayTo = fixture.payTo;
}, 120_000);

afterAll(async () => {
  await fixture.close();
}, 30_000);

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------
describe("MCPPlugin", () => {
  test("register() stores tools and mounts routes", async () => {
    const app = createApp();
    await app.withPlugin(new MCPPlugin(toolEntries));

    expect(app.routes.has("POST /mcp")).toBe(true);
    expect(app.routes.has("GET /mcp")).toBe(true);
    expect(app.routes.has("DELETE /mcp")).toBe(true);
  });

  test("registers tools without accepts (no payment)", async () => {
    const app = createApp();
    const plugin = new MCPPlugin([{ name: "add", exports: { default: mockTool } }]);
    await app.withPlugin(plugin);

    expect(plugin.registeredTools.length).toBe(1);
    expect(plugin.registeredTools[0].accepts).toBeUndefined();
  });

  test("registers tools with payment accepts", async () => {
    const app = createApp();
    const plugin = new MCPPlugin([
      { name: "add", exports: { default: mockTool, accepts: { scheme: "exact" as const, price: "$0.01" } } },
      { name: "fail", exports: { default: failingTool, accepts: { scheme: "exact" as const, price: "$0.05" } } },
    ]);
    await app.withPlugin(plugin);

    expect(plugin.registeredTools).toHaveLength(2);
    expect(plugin.registeredTools[0].accepts).toEqual({ scheme: "exact", price: "$0.01" });
    expect(plugin.registeredTools[1].accepts).toEqual({ scheme: "exact", price: "$0.05" });
    // No per-tool routes — payment is handled at the MCP protocol level
    expect(app.routes.get("POST /mcp")?.payment).toBeUndefined();
  });

  test("registers tools with array accepts (multiple networks)", async () => {
    const app = createApp();
    const multiAccepts = [
      { scheme: "exact" as const, price: "$0.01", network: "eip155:8453" },
      { scheme: "exact" as const, price: "$0.05", network: "eip155:1" },
    ];
    const plugin = new MCPPlugin([{ name: "add", exports: { default: mockTool, accepts: multiAccepts } }]);
    await app.withPlugin(plugin);

    expect(plugin.registeredTools).toHaveLength(1);
    expect(plugin.registeredTools[0].accepts).toEqual(multiAccepts);
  });

  // ---------------------------------------------------------------------------
  // POST /mcp — SSE response path
  // ---------------------------------------------------------------------------
  describe("POST /mcp", () => {
    test("initialize returns protocol info via SSE", async () => {
      const app = createApp();
      await app.withPlugin(new MCPPlugin(toolEntries));

      const res = await app.fetch(jsonRpcRequest("initialize", initParams, 42));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/event-stream");

      const json = await parseSSEJsonRpc(res);
      expect(json.jsonrpc).toBe("2.0");
      expect(json.id).toBe(42);
      expect(json.result.serverInfo.name).toBe("Test Agent");
      expect(json.result.serverInfo.version).toBe("1.0.0");
      expect(json.result.capabilities.tools).toEqual({ listChanged: true });
    });

    test("tools/list returns tool schemas", async () => {
      const app = createApp();
      await app.withPlugin(new MCPPlugin(toolEntries));

      await app.fetch(jsonRpcRequest("initialize", initParams));

      const res = await app.fetch(jsonRpcRequest("tools/list", undefined, 5));
      const json = await parseSSEJsonRpc(res);

      expect(json.jsonrpc).toBe("2.0");
      expect(json.id).toBe(5);
      expect(json.result.tools).toHaveLength(1);
      expect(json.result.tools[0].name).toBe("add");
      expect(json.result.tools[0].description).toBe("Add two numbers");
      expect(json.result.tools[0].inputSchema).toMatchObject({
        properties: {
          a: { type: "number" },
          b: { type: "number" },
        },
      });
    });

    test("tools/call executes tool correctly", async () => {
      const app = createApp();
      await app.withPlugin(new MCPPlugin(toolEntries));

      await app.fetch(jsonRpcRequest("initialize", initParams));

      const res = await app.fetch(jsonRpcRequest("tools/call", { name: "add", arguments: { a: 2, b: 3 } }, 10));
      const json = await parseSSEJsonRpc(res);

      expect(json.jsonrpc).toBe("2.0");
      expect(json.id).toBe(10);
      expect(json.result.content).toHaveLength(1);
      expect(json.result.content[0].type).toBe("text");
      expect(JSON.parse(json.result.content[0].text)).toEqual({ result: 5 });
    });

    test("tools/call with unknown tool returns error", async () => {
      const app = createApp();
      await app.withPlugin(new MCPPlugin(toolEntries));

      await app.fetch(jsonRpcRequest("initialize", initParams));

      const res = await app.fetch(jsonRpcRequest("tools/call", { name: "nonexistent" }, 11));
      const json = await parseSSEJsonRpc(res);

      expect(json.jsonrpc).toBe("2.0");
      expect(json.id).toBe(11);
      expect(json.result.isError).toBe(true);
      expect(json.result.content[0].text).toBe("MCP error -32602: Tool nonexistent not found");
    });

    test("tools/call when tool throws returns isError", async () => {
      const app = createApp();
      await app.withPlugin(new MCPPlugin(toolEntriesWithFailing));

      await app.fetch(jsonRpcRequest("initialize", initParams));

      const res = await app.fetch(jsonRpcRequest("tools/call", { name: "fail", arguments: {} }, 12));
      const json = await parseSSEJsonRpc(res);

      expect(json.jsonrpc).toBe("2.0");
      expect(json.id).toBe(12);
      expect(json.result.isError).toBe(true);
      expect(json.result.content[0].text).toBe("Error: broken");
    });

    test("unknown method returns error", async () => {
      const app = createApp();
      await app.withPlugin(new MCPPlugin(toolEntries));

      await app.fetch(jsonRpcRequest("initialize", initParams));

      const res = await app.fetch(jsonRpcRequest("unknown/method", undefined, 13));
      const json = await parseSSEJsonRpc(res);

      expect(json.jsonrpc).toBe("2.0");
      expect(json.id).toBe(13);
      expect(json.error).toEqual({ code: -32601, message: "Method not found" });
    });

    test("rejects POST without Accept header including both required types", async () => {
      const app = createApp();
      await app.withPlugin(new MCPPlugin(toolEntries));

      const res = await app.fetch(
        new Request("http://localhost/mcp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: initParams }),
        }),
      );

      expect(res.status).toBe(406);
    });

    test("rejects POST with Accept: text/event-stream only (missing application/json)", async () => {
      const app = createApp();
      await app.withPlugin(new MCPPlugin(toolEntries));

      const res = await app.fetch(
        new Request("http://localhost/mcp", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: initParams }),
        }),
      );

      expect(res.status).toBe(406);
    });

    test("rejects POST without Content-Type application/json", async () => {
      const app = createApp();
      await app.withPlugin(new MCPPlugin(toolEntries));

      const res = await app.fetch(
        new Request("http://localhost/mcp", {
          method: "POST",
          headers: { "Content-Type": "text/plain", Accept: "application/json, text/event-stream" },
          body: "not json",
        }),
      );

      expect(res.status).toBe(415);
    });

    test("rejects POST with invalid JSON body", async () => {
      const app = createApp();
      await app.withPlugin(new MCPPlugin(toolEntries));

      const res = await app.fetch(
        new Request("http://localhost/mcp", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
          body: "{not valid json",
        }),
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.message).toBe("Parse error: Invalid JSON");
    });

    test("rejects POST with invalid JSON-RPC structure", async () => {
      const app = createApp();
      await app.withPlugin(new MCPPlugin(toolEntries));

      const res = await app.fetch(
        new Request("http://localhost/mcp", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
          body: JSON.stringify({ not: "jsonrpc" }),
        }),
      );

      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /mcp — SSE stream endpoint
  // ---------------------------------------------------------------------------
  describe("GET /mcp", () => {
    test("returns SSE stream with correct Content-Type", async () => {
      const app = createApp();
      await app.withPlugin(new MCPPlugin(toolEntries));

      const res = await app.fetch(sseGetRequest());

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/event-stream");
      expect(res.headers.get("cache-control")).toBe("no-cache, no-transform");

      // Body should be a ReadableStream
      expect(res.body).toBeInstanceOf(ReadableStream);

      // Cancel the stream to clean up (it stays open for server-initiated messages)
      await res.body!.cancel();
    });

    test("rejects GET without Accept: text/event-stream", async () => {
      const app = createApp();
      await app.withPlugin(new MCPPlugin(toolEntries));

      const res = await app.fetch(
        new Request("http://localhost/mcp", {
          method: "GET",
          headers: { Accept: "application/json" },
        }),
      );

      expect(res.status).toBe(406);
      const json = await res.json();
      expect(json.error.message).toBe("Not Acceptable: Client must accept text/event-stream");
    });

    test("rejects GET with no Accept header", async () => {
      const app = createApp();
      await app.withPlugin(new MCPPlugin(toolEntries));

      const res = await app.fetch(new Request("http://localhost/mcp", { method: "GET" }));

      expect(res.status).toBe(406);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /mcp — session termination
  // ---------------------------------------------------------------------------
  describe("DELETE /mcp", () => {
    test("returns 200 for stateless transport", async () => {
      const app = createApp();
      await app.withPlugin(new MCPPlugin(toolEntries));

      const res = await app.fetch(deleteRequest());

      expect(res.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // 404 for unregistered routes
  // ---------------------------------------------------------------------------
  test("unregistered method returns 404 from app router", async () => {
    const app = createApp();
    await app.withPlugin(new MCPPlugin(toolEntries));

    const res = await app.fetch(new Request("http://localhost/mcp", { method: "PUT" }));

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// x402 payment integration (MCP protocol level)
// ---------------------------------------------------------------------------

describe("MCPPlugin x402 payment", () => {
  // Single-tool paid app for most tests
  let paidUrl: string;
  let stopPaidServer: () => void;

  // Multi-tool app (free + paid)
  let mixedUrl: string;
  let stopMixedServer: () => void;

  // Multi-price app
  let multiPriceUrl: string;
  let stopMultiPriceServer: () => void;

  beforeAll(async () => {
    // Single paid tool app
    const paidApp = new AixyzApp({ facilitators: fixture.facilitator });
    await paidApp.withPlugin(
      new MCPPlugin([
        { name: "add", exports: { default: mockTool, accepts: { scheme: "exact" as const, price: "$0.01" } } },
      ]),
    );
    await paidApp.initialize();
    ({ url: paidUrl, stop: stopPaidServer } = await fixture.serve(paidApp));

    // Mixed free + paid app
    const mixedApp = new AixyzApp({ facilitators: fixture.facilitator });
    await mixedApp.withPlugin(
      new MCPPlugin([
        { name: "add", exports: { default: mockTool, accepts: { scheme: "free" as const } } },
        { name: "fail", exports: { default: failingTool, accepts: { scheme: "exact" as const, price: "$0.05" } } },
      ]),
    );
    await mixedApp.initialize();
    ({ url: mixedUrl, stop: stopMixedServer } = await fixture.serve(mixedApp));

    // Multi-price app
    const multiPriceApp = new AixyzApp({ facilitators: fixture.facilitator });
    await multiPriceApp.withPlugin(
      new MCPPlugin([
        { name: "add", exports: { default: mockTool, accepts: { scheme: "exact" as const, price: "$0.001" } } },
        { name: "fail", exports: { default: failingTool, accepts: { scheme: "exact" as const, price: "$1.00" } } },
      ]),
    );
    await multiPriceApp.initialize();
    ({ url: multiPriceUrl, stop: stopMultiPriceServer } = await fixture.serve(multiPriceApp));
  });

  afterAll(() => {
    stopPaidServer?.();
    stopMixedServer?.();
    stopMultiPriceServer?.();
  });

  test("paid tool without payment throws DryRunPaymentRequired", async () => {
    try {
      await callMcpTool(paidUrl, "add", { a: 1, b: 2 });
      expect.unreachable("expected DryRunPaymentRequired");
    } catch (e) {
      expect(e).toBeInstanceOf(DryRunPaymentRequired);
      expect((e as DryRunPaymentRequired).requirements).toStrictEqual([
        expect.objectContaining({ scheme: "exact", network: "eip155:8453", payTo: fixture.payTo, amount: "10000" }),
      ]);
    }
  });

  test("paid tool with valid payment succeeds", async () => {
    const result = await callMcpTool(paidUrl, "add", { a: 2, b: 3 }, { transaction: PayTransaction(fixture.wallet) });
    const content = result.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(content[0].text)).toEqual({ result: 5 });
  }, 30_000);

  test("initialize and tools/list do not require payment", async () => {
    const tools = await listMcpTools(paidUrl);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("add");
  });

  test("free tool does not require payment even when paid tools exist", async () => {
    const result = await callMcpTool(mixedUrl, "add", { a: 1, b: 2 });
    const content = result.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(content[0].text)).toEqual({ result: 3 });
  });

  test("add tool ($0.001) returns correct price in payment requirements", async () => {
    try {
      await callMcpTool(multiPriceUrl, "add", { a: 1, b: 2 }, { fetchImpl: createDryRunFetch() });
      expect.unreachable("expected DryRunPaymentRequired");
    } catch (e) {
      expect(e).toBeInstanceOf(DryRunPaymentRequired);
      expect((e as DryRunPaymentRequired).requirements).toStrictEqual([
        expect.objectContaining({ scheme: "exact", network: "eip155:8453", payTo: fixture.payTo, amount: "1000" }),
      ]);
    }
  });

  test("fail tool ($1.00) returns correct price in payment requirements", async () => {
    try {
      await callMcpTool(multiPriceUrl, "fail", {}, { fetchImpl: createDryRunFetch() });
      expect.unreachable("expected DryRunPaymentRequired");
    } catch (e) {
      expect(e).toBeInstanceOf(DryRunPaymentRequired);
      expect((e as DryRunPaymentRequired).requirements).toStrictEqual([
        expect.objectContaining({ scheme: "exact", network: "eip155:8453", payTo: fixture.payTo, amount: "1000000" }),
      ]);
    }
  });
});
