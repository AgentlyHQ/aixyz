import { describe, expect, mock, test } from "bun:test";

mock.module("@aixyz/config", () => ({
  getAixyzConfig: () => ({
    name: "Test Agent",
    description: "A test agent",
    version: "1.0.0",
    url: "http://localhost:3000",
    x402: { payTo: "0x1234", network: "eip155:8453" },
    build: { tools: [], agents: [], excludes: [] },
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
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader } from "@x402/core/http";
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
    throw new Error("broken");
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

const toolEntries = [{ name: "add", exports: { default: mockTool, accepts: { scheme: "free" as const } } }];

const toolEntriesWithFailing = [
  { name: "add", exports: { default: mockTool, accepts: { scheme: "free" as const } } },
  { name: "fail", exports: { default: failingTool, accepts: { scheme: "free" as const } } },
];

const initParams = { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1.0" } };

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

  test("skips tools without accepts", async () => {
    const app = createApp();
    const plugin = new MCPPlugin([{ name: "add", exports: { default: mockTool } }]);
    await app.withPlugin(plugin);

    expect(plugin.registeredTools.length).toBe(0);
  });

  test("registers per-tool routes with payment on the app", async () => {
    const app = createApp();
    await app.withPlugin(
      new MCPPlugin([
        { name: "add", exports: { default: mockTool, accepts: { scheme: "exact" as const, price: "$0.01" } } },
        { name: "fail", exports: { default: failingTool, accepts: { scheme: "exact" as const, price: "$0.05" } } },
      ]),
    );

    expect(app.routes.get("POST /mcp")?.payment).toBeUndefined();
    expect(app.routes.get("POST /mcp/tools/add")?.payment).toEqual({ scheme: "exact", price: "$0.01" });
    expect(app.routes.get("POST /mcp/tools/fail")?.payment).toEqual({ scheme: "exact", price: "$0.05" });
  });

  test("does not register per-tool routes for free tools", async () => {
    const app = createApp();
    await app.withPlugin(new MCPPlugin(toolEntries));

    expect(app.routes.has("POST /mcp/tools/add")).toBe(false);
  });

  test("dispatches tools/call for paid tool through per-tool route", async () => {
    const app = createApp();
    await app.withPlugin(
      new MCPPlugin([
        { name: "add", exports: { default: mockTool, accepts: { scheme: "exact" as const, price: "$0.01" } } },
      ]),
    );

    // tools/call on a paid tool should be routed through /mcp/tools/add
    await app.fetch(jsonRpcRequest("initialize", initParams));
    const res = await app.fetch(jsonRpcRequest("tools/call", { name: "add", arguments: { a: 2, b: 3 } }));
    const json = await res.json();

    expect(json.result.content[0].type).toBe("text");
    expect(JSON.parse(json.result.content[0].text)).toEqual({ result: 5 });
  });

  test("free tool calls go through main /mcp handler", async () => {
    const app = createApp();
    await app.withPlugin(new MCPPlugin(toolEntries));

    await app.fetch(jsonRpcRequest("initialize", initParams));
    const res = await app.fetch(jsonRpcRequest("tools/call", { name: "add", arguments: { a: 2, b: 3 } }));
    const json = await res.json();

    expect(json.result.content[0].type).toBe("text");
    expect(JSON.parse(json.result.content[0].text)).toEqual({ result: 5 });
  });

  // ---------------------------------------------------------------------------
  // POST /mcp — JSON response path (enableJsonResponse: true)
  // ---------------------------------------------------------------------------
  describe("POST /mcp", () => {
    test("initialize returns protocol info", async () => {
      const app = createApp();
      await app.withPlugin(new MCPPlugin(toolEntries));

      const res = await app.fetch(jsonRpcRequest("initialize", initParams, 42));
      const json = await res.json();

      expect(json.jsonrpc).toBe("2.0");
      expect(json.id).toBe(42);
      expect(json.result.serverInfo.name).toBe("aixyz-mcp");
      expect(json.result.serverInfo.version).toBe("1.0.0");
      expect(json.result.capabilities.tools).toEqual({ listChanged: true });
    });

    test("initialize response has Content-Type application/json", async () => {
      const app = createApp();
      await app.withPlugin(new MCPPlugin(toolEntries));

      const res = await app.fetch(jsonRpcRequest("initialize", initParams));
      expect(res.headers.get("content-type")).toBe("application/json");
    });

    test("tools/list returns tool schemas", async () => {
      const app = createApp();
      await app.withPlugin(new MCPPlugin(toolEntries));

      await app.fetch(jsonRpcRequest("initialize", initParams));

      const res = await app.fetch(jsonRpcRequest("tools/list", undefined, 5));
      const json = await res.json();

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
      const json = await res.json();

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
      const json = await res.json();

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
      const json = await res.json();

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
      const json = await res.json();

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
  // SSE stream response format (POST without enableJsonResponse)
  // ---------------------------------------------------------------------------
  describe("SSE stream response", () => {
    test("initialize via SSE returns event-stream with valid JSON-RPC", async () => {
      // Create a plugin subclass that disables JSON response mode to exercise SSE path
      class SSEMCPPlugin extends MCPPlugin {
        async register(app: AixyzApp): Promise<void> {
          // Re-implement register with enableJsonResponse: false
          for (const t of (this as any).tools) {
            if (t.exports.accepts) {
              const { AcceptsScheme } = await import("../../accepts");
              AcceptsScheme.parse(t.exports.accepts);
            } else {
              continue;
            }
            const tool = t.exports.default;
            if (!tool.execute) throw new Error(`Tool "${t.name}" has no execute function`);
            this.registeredTools.push({ name: t.name, tool, accepts: t.exports.accepts });
          }

          const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
          const { WebStandardStreamableHTTPServerTransport } =
            await import("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js");

          const createServer = () => {
            const mcpServer = new McpServer(
              { name: "aixyz-mcp", version: "1.0.0" },
              { capabilities: { tools: { listChanged: false } } },
            );
            for (const { name, tool } of this.registeredTools) {
              mcpServer.registerTool(
                name,
                { description: tool.description, inputSchema: tool.inputSchema as any },
                async (args: Record<string, unknown>) => {
                  try {
                    const result = await tool.execute!(args, { toolCallId: name, messages: [] });
                    const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
                    return { content: [{ type: "text" as const, text }] };
                  } catch (error) {
                    const text = error instanceof Error ? error.message : "Unknown error";
                    return { content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true };
                  }
                },
              );
            }
            return mcpServer;
          };

          const handler = async (request: Request) => {
            const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: false });
            const server = createServer();
            await server.connect(transport);
            return transport.handleRequest(request);
          };

          app.route("POST", "/mcp", handler);
          app.route("GET", "/mcp", handler);
          app.route("DELETE", "/mcp", handler);
        }
      }

      const app = createApp();
      await app.withPlugin(new SSEMCPPlugin(toolEntries));

      const res = await app.fetch(jsonRpcRequest("initialize", initParams, 1));

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/event-stream");

      // Read the SSE stream body
      const text = await res.text();
      const events = parseSSEEvents(text);

      expect(events.length).toBe(1);

      const messageEvent = events[0];
      expect(messageEvent.event).toBe("message");

      const jsonRpc = JSON.parse(messageEvent.data);
      expect(jsonRpc.jsonrpc).toBe("2.0");
      expect(jsonRpc.id).toBe(1);
      expect(jsonRpc.result.serverInfo.name).toBe("aixyz-mcp");
    });

    test("tools/call via SSE returns result in event-stream format", async () => {
      class SSEMCPPlugin extends MCPPlugin {
        async register(app: AixyzApp): Promise<void> {
          for (const t of (this as any).tools) {
            if (t.exports.accepts) {
              const { AcceptsScheme } = await import("../../accepts");
              AcceptsScheme.parse(t.exports.accepts);
            } else {
              continue;
            }
            const tool = t.exports.default;
            if (!tool.execute) throw new Error(`Tool "${t.name}" has no execute function`);
            this.registeredTools.push({ name: t.name, tool, accepts: t.exports.accepts });
          }

          const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
          const { WebStandardStreamableHTTPServerTransport } =
            await import("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js");

          const createServer = () => {
            const mcpServer = new McpServer(
              { name: "aixyz-mcp", version: "1.0.0" },
              { capabilities: { tools: { listChanged: false } } },
            );
            for (const { name, tool } of this.registeredTools) {
              mcpServer.registerTool(
                name,
                { description: tool.description, inputSchema: tool.inputSchema as any },
                async (args: Record<string, unknown>) => {
                  try {
                    const result = await tool.execute!(args, { toolCallId: name, messages: [] });
                    const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
                    return { content: [{ type: "text" as const, text }] };
                  } catch (error) {
                    const text = error instanceof Error ? error.message : "Unknown error";
                    return { content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true };
                  }
                },
              );
            }
            return mcpServer;
          };

          const handler = async (request: Request) => {
            const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: false });
            const server = createServer();
            await server.connect(transport);
            return transport.handleRequest(request);
          };

          app.route("POST", "/mcp", handler);
          app.route("GET", "/mcp", handler);
          app.route("DELETE", "/mcp", handler);
        }
      }

      const app = createApp();
      await app.withPlugin(new SSEMCPPlugin(toolEntries));

      // Initialize first
      await app.fetch(jsonRpcRequest("initialize", initParams));

      // Call tool
      const res = await app.fetch(jsonRpcRequest("tools/call", { name: "add", arguments: { a: 10, b: 20 } }, 7));

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/event-stream");

      const text = await res.text();
      const events = parseSSEEvents(text);
      const messageEvent = events.find((e) => e.event === "message");

      const jsonRpc = JSON.parse(messageEvent!.data);
      expect(jsonRpc.jsonrpc).toBe("2.0");
      expect(jsonRpc.id).toBe(7);
      expect(jsonRpc.result.content[0].type).toBe("text");
      expect(JSON.parse(jsonRpc.result.content[0].text)).toEqual({ result: 30 });
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
// x402 payment integration
// ---------------------------------------------------------------------------

const mockFacilitator = {
  verify: async () => ({ isValid: true, invalidReason: undefined }),
  settle: async () => ({ success: true }),
  getSupported: async () => ({
    kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:8453" }],
    extensions: [],
    signers: {},
  }),
} as any;

function paidJsonRpcRequest(
  path: string,
  method: string,
  params?: unknown,
  headers?: Record<string, string>,
  id: number = 1,
): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
}

async function createPaymentHeader(app: AixyzApp, path: string): Promise<string> {
  const res = await app.fetch(new Request(`http://localhost${path}`, { method: "POST" }));
  if (res.status !== 402) throw new Error(`Expected 402 but got ${res.status}`);
  const header = res.headers.get("payment-required");
  if (!header) throw new Error("Missing payment-required header");
  const decoded = decodePaymentRequiredHeader(header);
  return encodePaymentSignatureHeader({
    x402Version: decoded.x402Version,
    resource: decoded.resource,
    accepted: decoded.accepts[0],
    payload: { signature: "0xfake" },
  });
}

describe("MCPPlugin x402 payment", () => {
  test("tools/call returns 402 with correct amount for paid tool without payment header", async () => {
    const app = new AixyzApp({ facilitators: mockFacilitator });
    await app.withPlugin(
      new MCPPlugin([
        { name: "add", exports: { default: mockTool, accepts: { scheme: "exact" as const, price: "$0.01" } } },
      ]),
    );
    await app.initialize();

    const res = await app.fetch(paidJsonRpcRequest("/mcp", "tools/call", { name: "add", arguments: { a: 1, b: 2 } }));
    expect(res.status).toBe(402);

    const decoded = decodePaymentRequiredHeader(res.headers.get("payment-required")!);
    expect(decoded.accepts).toHaveLength(1);
    expect(decoded.accepts[0].scheme).toBe("exact");
    expect(decoded.accepts[0].network).toBe("eip155:8453");
    expect(decoded.accepts[0].amount).toBe("10000"); // $0.01 = 10000 (USDC 6 decimals)
    expect(decoded.accepts[0].payTo).toBe("0x1234");
  });

  test("tools/call returns 200 with result for paid tool with valid payment header", async () => {
    const app = new AixyzApp({ facilitators: mockFacilitator });
    await app.withPlugin(
      new MCPPlugin([
        { name: "add", exports: { default: mockTool, accepts: { scheme: "exact" as const, price: "$0.01" } } },
      ]),
    );
    await app.initialize();

    const paymentHeader = await createPaymentHeader(app, "/mcp/tools/add");
    const res = await app.fetch(
      paidJsonRpcRequest(
        "/mcp",
        "tools/call",
        { name: "add", arguments: { a: 2, b: 3 } },
        {
          "payment-signature": paymentHeader,
        },
      ),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.jsonrpc).toBe("2.0");
    expect(json.id).toBe(1);
    expect(json.result.content).toHaveLength(1);
    expect(json.result.content[0].type).toBe("text");
    expect(JSON.parse(json.result.content[0].text)).toEqual({ result: 5 });
  });

  test("initialize and tools/list do not require payment", async () => {
    const app = new AixyzApp({ facilitators: mockFacilitator });
    await app.withPlugin(
      new MCPPlugin([
        { name: "add", exports: { default: mockTool, accepts: { scheme: "exact" as const, price: "$0.01" } } },
      ]),
    );
    await app.initialize();

    const initRes = await app.fetch(paidJsonRpcRequest("/mcp", "initialize", initParams));
    expect(initRes.status).toBe(200);
    const initJson = await initRes.json();
    expect(initJson.result.serverInfo.name).toBe("aixyz-mcp");

    const listRes = await app.fetch(paidJsonRpcRequest("/mcp", "tools/list", undefined, undefined, 2));
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.result.tools).toHaveLength(1);
    expect(listJson.result.tools[0].name).toBe("add");
  });

  test("free tool does not require payment even when paid tools exist", async () => {
    const app = new AixyzApp({ facilitators: mockFacilitator });
    await app.withPlugin(
      new MCPPlugin([
        { name: "add", exports: { default: mockTool, accepts: { scheme: "free" as const } } },
        { name: "fail", exports: { default: failingTool, accepts: { scheme: "exact" as const, price: "$0.05" } } },
      ]),
    );
    await app.initialize();

    await app.fetch(paidJsonRpcRequest("/mcp", "initialize", initParams));
    const res = await app.fetch(paidJsonRpcRequest("/mcp", "tools/call", { name: "add", arguments: { a: 1, b: 2 } }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.jsonrpc).toBe("2.0");
    expect(json.id).toBe(1);
    expect(json.result.content).toHaveLength(1);
    expect(json.result.content[0].type).toBe("text");
    expect(JSON.parse(json.result.content[0].text)).toEqual({ result: 3 });
  });

  test("each tool has its own price in the 402 response", async () => {
    const app = new AixyzApp({ facilitators: mockFacilitator });
    await app.withPlugin(
      new MCPPlugin([
        { name: "add", exports: { default: mockTool, accepts: { scheme: "exact" as const, price: "$0.001" } } },
        { name: "fail", exports: { default: failingTool, accepts: { scheme: "exact" as const, price: "$1.00" } } },
      ]),
    );
    await app.initialize();

    const addRes = await app.fetch(
      paidJsonRpcRequest("/mcp", "tools/call", { name: "add", arguments: { a: 1, b: 2 } }),
    );
    const failRes = await app.fetch(paidJsonRpcRequest("/mcp", "tools/call", { name: "fail", arguments: {} }));

    expect(addRes.status).toBe(402);
    expect(failRes.status).toBe(402);

    const addDecoded = decodePaymentRequiredHeader(addRes.headers.get("payment-required")!);
    expect(addDecoded.accepts).toHaveLength(1);
    expect(addDecoded.accepts[0].scheme).toBe("exact");
    expect(addDecoded.accepts[0].network).toBe("eip155:8453");
    expect(addDecoded.accepts[0].payTo).toBe("0x1234");
    expect(addDecoded.accepts[0].amount).toBe("1000"); // $0.001 = 1000 (USDC 6 decimals)

    const failDecoded = decodePaymentRequiredHeader(failRes.headers.get("payment-required")!);
    expect(failDecoded.accepts).toHaveLength(1);
    expect(failDecoded.accepts[0].scheme).toBe("exact");
    expect(failDecoded.accepts[0].network).toBe("eip155:8453");
    expect(failDecoded.accepts[0].payTo).toBe("0x1234");
    expect(failDecoded.accepts[0].amount).toBe("1000000"); // $1.00 = 1000000 (USDC 6 decimals)
  });
});
