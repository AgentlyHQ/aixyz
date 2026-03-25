import { AsyncLocalStorage } from "node:async_hooks";
import { type Tool } from "ai";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createPaymentWrapper } from "@x402/mcp";
import { BasePlugin, type RegisterContext, type InitializeContext } from "../plugin";
import type { Accepts } from "../../accepts";
import { AcceptsScheme } from "../../accepts";
import { getAixyzConfig, getAixyzConfigRuntime } from "../../config";
import { Network } from "@x402/core/types";
import type { SessionPlugin } from "./session";

/**
 * AsyncLocalStorage to pass the MCP-level payer address from the
 * onAfterVerify hook to the tool handler within the same async context.
 */
const mcpPayerStorage = new AsyncLocalStorage<{ payer?: string }>();

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
  private sessionPlugin?: SessionPlugin;

  constructor(private tools: Array<{ name: string; exports: { default: Tool; accepts?: Accepts } }>) {
    super();
  }

  private createMcpServer(): McpServer {
    const config = getAixyzConfigRuntime();
    const mcpServer = new McpServer({ name: config.name, version: config.version }, { capabilities: { tools: {} } });

    for (const { name, tool } of this.registeredTools) {
      const sessionPlugin = this.sessionPlugin;
      const handler = async (args: Record<string, unknown>) => {
        const execute = async () => {
          try {
            const result = await tool.execute!(args, { toolCallId: name, messages: [] });
            const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
            return { content: [{ type: "text" as const, text }] };
          } catch (error) {
            const text = error instanceof Error ? error.message : "Unknown error";
            return { content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true };
          }
        };

        // If SessionPlugin is active and a payer was captured from MCP-level payment,
        // run the tool within a session context so getSession() works.
        const payer = mcpPayerStorage.getStore()?.payer;
        if (sessionPlugin && payer) {
          return sessionPlugin.runWithPayer(payer, execute);
        }
        return execute();
      };

      const wrapper = this.paymentWrappers.get(name);
      let registeredHandler: (args: any, extra?: any) => any;
      if (wrapper) {
        const wrapped = wrapper(handler);
        // Wrap the payment wrapper call in mcpPayerStorage.run() so the
        // onAfterVerify hook and handler share the same async context.
        registeredHandler = sessionPlugin
          ? (args: any, extra: any) => mcpPayerStorage.run({ payer: undefined }, () => wrapped(args, extra))
          : wrapped;
      } else {
        registeredHandler = handler;
      }
      mcpServer.registerTool(
        name,
        { description: tool.description, inputSchema: tool.inputSchema as any },
        registeredHandler,
      );
    }

    return mcpServer;
  }

  async register(ctx: RegisterContext): Promise<void> {
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

    ctx.route("POST", "/mcp", mcpHandler);
    ctx.route("GET", "/mcp", mcpHandler);
    ctx.route("DELETE", "/mcp", mcpHandler);
  }

  async initialize(ctx: InitializeContext): Promise<void> {
    this.sessionPlugin = ctx.getPlugin<SessionPlugin>("session") as SessionPlugin | undefined;

    if (!ctx.payment) return;

    const config = getAixyzConfig();
    const resourceServer = ctx.payment.resourceServer;

    // Capture payer from MCP-level payment verification for session integration.
    // This hook is global (fires for all verifications, including HTTP-level), but
    // only writes when mcpPayerStorage has an active context — which only happens
    // inside MCP tool calls wrapped by mcpPayerStorage.run() below.
    if (this.sessionPlugin) {
      ctx.payment.onAfterVerify(async (context) => {
        const store = mcpPayerStorage.getStore();
        if (store && context.result.payer) {
          store.payer = context.result.payer;
        }
      });
    }

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
