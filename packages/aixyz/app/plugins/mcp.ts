import { type Tool } from "ai";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { BasePlugin } from "../plugin";
import type { AixyzApp } from "../index";
import { createDispatcher } from "../dispatcher";
import type { Accepts } from "../../accepts";
import { AcceptsScheme } from "../../accepts";
import { getAixyzConfigRuntime } from "../../config";

/**
 * MCP (Model Context Protocol) plugin. Collects tools and exposes them
 * via a Streamable HTTP endpoint at `/mcp` using the official MCP SDK.
 */
export class MCPPlugin extends BasePlugin {
  readonly name = "mcp";
  readonly registeredTools: Array<{ name: string; tool: Tool; accepts: Accepts }> = [];

  constructor(private tools: Array<{ name: string; exports: { default: Tool; accepts?: Accepts } }>) {
    super();
  }

  private createMcpServer(): McpServer {
    const config = getAixyzConfigRuntime();
    const mcpServer = new McpServer(
      { name: config.name, version: config.version },
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
  }

  async register(app: AixyzApp): Promise<void> {
    for (const t of this.tools) {
      if (t.exports.accepts) {
        AcceptsScheme.parse(t.exports.accepts);
      } else {
        continue;
      }

      const tool = t.exports.default;
      if (!tool.execute) {
        throw new Error(`Tool "${t.name}" has no execute function`);
      }

      this.registeredTools.push({ name: t.name, tool, accepts: t.exports.accepts });
    }

    // TODO: The MCP SDK (v1.27.1) enforces a 1:1 server-to-transport relationship and prevents
    // stateless transport reuse (_hasHandledRequest guard in webStandardStreamableHttp.js:139).
    // Once the SDK ships v2.0 (which removes this guard), hoist both server and transport to
    // avoid per-request McpServer + Ajv instantiation.
    const mcpHandler = async (request: Request) => {
      const transport = new WebStandardStreamableHTTPServerTransport({});
      const server = this.createMcpServer();
      await server.connect(transport);
      return transport.handleRequest(request);
    };

    // Build a set of paid tool names for fast lookup.
    const paidToolNames = new Set(this.registeredTools.filter((t) => t.accepts.scheme === "exact").map((t) => t.name));

    // Register per-tool routes with payment config. The app's fetch() handles x402 verification.
    for (const { name, accepts } of this.registeredTools) {
      if (accepts.scheme === "exact") {
        app.route("POST", `/mcp/tools/${name}`, mcpHandler, { payment: accepts });
      }
    }

    // Main /mcp handler — dispatches tools/call for paid tools through per-tool routes.
    const dispatch = createDispatcher(app);
    const handler = async (request: Request) => {
      if (request.method === "POST" && paidToolNames.size > 0) {
        const clone = request.clone();
        try {
          const body = await clone.json();
          if (body.method === "tools/call" && paidToolNames.has(body.params?.name)) {
            const syntheticRequest = new Request(
              new URL(`/mcp/tools/${body.params.name}`, new URL(request.url).origin),
              { method: "POST", headers: request.headers, body: JSON.stringify(body) },
            );
            return dispatch(syntheticRequest);
          }
        } catch {
          // Body parse failures are handled by the MCP SDK below.
        }
      }
      return mcpHandler(request);
    };

    app.route("POST", "/mcp", handler);
    app.route("GET", "/mcp", handler);
    app.route("DELETE", "/mcp", handler);
  }
}
