import { describe, expect, test } from "bun:test";
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
      expect(json.result.capabilities.tools).toBeDefined();
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
      expect(json.error ?? json.result?.isError).toBeTruthy();
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
      expect(json.result.content[0].text).toContain("broken");
    });

    test("unknown method returns error", async () => {
      const app = createApp();
      await app.withPlugin(new MCPPlugin(toolEntries));

      await app.fetch(jsonRpcRequest("initialize", initParams));

      const res = await app.fetch(jsonRpcRequest("unknown/method", undefined, 13));
      const json = await res.json();

      expect(json.jsonrpc).toBe("2.0");
      expect(json.id).toBe(13);
      expect(json.error).toBeDefined();
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
      expect(json.error.message).toContain("Parse error");
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
      expect(res.headers.get("cache-control")).toContain("no-cache");

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
      expect(json.error.message).toContain("text/event-stream");
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

      expect(events.length).toBeGreaterThanOrEqual(1);

      // Find the message event containing the JSON-RPC response
      const messageEvent = events.find((e) => e.event === "message");
      expect(messageEvent).toBeDefined();

      const jsonRpc = JSON.parse(messageEvent!.data);
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
      expect(messageEvent).toBeDefined();

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
