import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Tool } from "ai";
import express from "express";
import type { IncomingMessage, ServerResponse } from "node:http";
import { AixyzServer } from "../index.js";
import { createPaymentWrapper } from "@x402/mcp";
import { Accepts, AcceptsX402 } from "../../accepts.js";

export class AixyzMCP {
  private registeredTools: Array<{
    name: string;
    config: any;
    handler: any;
  }> = [];

  constructor(private app: AixyzServer) {}

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
    this.app.express.post("/mcp", express.json(), async (req: express.Request, res: express.Response) => {
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

  private async withPayment(accepts: AcceptsX402) {
    const payments = await this.app.withPaymentRequirements(accepts);
    return createPaymentWrapper(this.app, {
      accepts: payments,
    });
  }

  async register(
    name: string,
    exports: {
      default: Tool;
      accepts?: Accepts;
    },
  ) {
    if (!exports.accepts) {
      // TODO(@fuxingloh): right now we just don't register the agent if accepts is not provided,
      //  but it might be a better idea to do it in aixyz-cli (aixyz-pack).
      return;
    }

    const tool = exports.default;
    if (!tool.execute) {
      throw new Error(`Tool "${name}" has no execute function`);
    }

    // TODO(@fuxingloh): add ext-app support:
    //  import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";

    const execute = tool.execute;
    const config = {
      description: tool.description,
      ...(tool.inputSchema && "shape" in tool.inputSchema ? { inputSchema: tool.inputSchema.shape } : {}),
    };

    const handler = async (args: Record<string, unknown>) => {
      try {
        const result = await execute(args, { toolCallId: name, messages: [] });
        const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        const text = error instanceof Error ? error.message : "An unknown error occurred";
        return { content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true };
      }
    };

    this.registeredTools.push({
      name,
      config,
      handler: exports.accepts.scheme === "exact" ? (await this.withPayment(exports.accepts))(handler) : handler,
    });
  }
}
