import { type Tool } from "ai";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createPaymentWrapper } from "@x402/mcp";
import { BasePlugin } from "../plugin";
import type { AixyzApp } from "../index";
import type { Accepts } from "../../accepts";
import { AcceptsScheme } from "../../accepts";
import { getAixyzConfig, getAixyzConfigRuntime } from "../../config";
import { Network } from "@x402/core/types";

/**
 * MCP (Model Context Protocol) plugin. Collects tools and exposes them
 * via a Streamable HTTP endpoint at `/mcp` using the official MCP SDK.
 *
 * Payment for paid tools is handled at the MCP protocol level using
 * `@x402/mcp`'s `createPaymentWrapper`, which negotiates payment via
 * `_meta["x402/payment"]` in the tool call params rather than HTTP headers.
 */
export class MCPPlugin extends BasePlugin {
  readonly name = "mcp";
  readonly registeredTools: Array<{ name: string; tool: Tool; accepts?: Accepts }> = [];
  private paymentWrappers = new Map<string, (handler: any) => any>();

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
      const handler = async (args: Record<string, unknown>) => {
        try {
          const result = await tool.execute!(args, { toolCallId: name, messages: [] });
          const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
          return { content: [{ type: "text" as const, text }] };
        } catch (error) {
          const text = error instanceof Error ? error.message : "Unknown error";
          return { content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true };
        }
      };

      const wrapper = this.paymentWrappers.get(name);
      mcpServer.registerTool(
        name,
        { description: tool.description, inputSchema: tool.inputSchema as any },
        wrapper ? wrapper(handler) : handler,
      );
    }

    return mcpServer;
  }

  async register(app: AixyzApp): Promise<void> {
    for (const t of this.tools) {
      if (t.exports.accepts) {
        AcceptsScheme.parse(t.exports.accepts);
      }

      const tool = t.exports.default;
      if (!tool.execute) {
        throw new Error(`Tool "${t.name}" has no execute function`);
      }

      this.registeredTools.push({ name: t.name, tool, accepts: t.exports.accepts });
    }

    const mcpHandler = async (request: Request) => {
      const transport = new WebStandardStreamableHTTPServerTransport({});
      const server = this.createMcpServer();
      await server.connect(transport);
      return transport.handleRequest(request);
    };

    app.route("POST", "/mcp", mcpHandler);
    app.route("GET", "/mcp", mcpHandler);
    app.route("DELETE", "/mcp", mcpHandler);
  }

  async initialize(app: AixyzApp): Promise<void> {
    if (!app.payment) return;

    const config = getAixyzConfig();
    const resourceServer = app.payment.resourceServer;

    for (const { name, accepts } of this.registeredTools) {
      if (accepts?.scheme !== "exact") continue;

      const reqs = await resourceServer.buildPaymentRequirements({
        scheme: accepts.scheme,
        payTo: accepts.payTo ?? config.x402.payTo,
        price: accepts.price,
        network: (accepts.network as Network) ?? (config.x402.network as Network),
      });

      this.paymentWrappers.set(
        name,
        createPaymentWrapper(resourceServer, {
          accepts: reqs,
          resource: { url: `mcp://tool/${name}` },
        }),
      );
    }
  }
}
