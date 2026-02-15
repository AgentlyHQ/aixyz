import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Tool } from "ai";
import express from "express";
import type { IncomingMessage, ServerResponse } from "node:http";
import { AixyzApp, X402Accepts } from "../index";
import { createPaymentWrapper } from "@x402/mcp";

export class AixyzMCP {
  private registeredTools: Array<{
    name: string;
    config: any;
    handler: any;
  }> = [];

  constructor(private app: AixyzApp) {}

  private createServer(): McpServer {
    const server = new McpServer({
      name: this.app.config.name,
      version: this.app.config.version,
    });
    for (const { name, config, handler } of this.registeredTools) {
      server.registerTool(name, config, handler);
    }
    return server;
  }

  public async connect() {
    this.app.express.post("/mcp", express.json(), async (req, res) => {
      const server = this.createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      await server.connect(transport);
      await transport.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse, req.body);

      const cleanup = () => {
        transport.close();
        server.close();
      };
      res.on("finish", cleanup);
      res.on("close", cleanup);
    });
  }

  private async withPayment(accepts: X402Accepts) {
    const payments = await this.app.withPaymentRequirements(accepts);
    return createPaymentWrapper(this.app, {
      accepts: payments,
    });
  }

  async register(
    name: string,
    exports: {
      default: Tool;
      accepts: X402Accepts;
    },
  ) {
    const tool = exports.default;
    if (!tool.execute) {
      throw new Error(`Tool "${name}" has no execute function`);
    }

    // TODO(@fuxingloh): add ext-app support:
    //  import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";

    const paid = await this.withPayment(exports.accepts);
    const execute = tool.execute;
    const config = {
      description: tool.description,
      ...(tool.inputSchema && "shape" in tool.inputSchema ? { inputSchema: tool.inputSchema.shape } : {}),
    };
    this.registeredTools.push({
      name,
      config,
      handler: paid(async (args: Record<string, unknown>) => {
        try {
          const result = await execute(args, { toolCallId: name, messages: [] });
          const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
          return { content: [{ type: "text" as const, text }] };
        } catch (error) {
          const text = error instanceof Error ? error.message : "An unknown error occurred";
          return { content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true };
        }
      }),
    });
  }
}
