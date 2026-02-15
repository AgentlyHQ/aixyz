import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Tool } from "ai";
import express from "express";
import type { IncomingMessage, ServerResponse } from "node:http";
import { AixyzApp, X402Accepts } from "../index";
import { createPaymentWrapper } from "@x402/mcp";
import { randomUUID } from "node:crypto";

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
    // TODO(@fuxingloh): use signed x402 address for the session id?
    const transports = new Map<string, StreamableHTTPServerTransport>();

    this.app.express.post("/mcp", express.json(), async (req, res) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId) {
        const transport = transports.get(sessionId);
        if (!transport) {
          res.status(404).end();
          return;
        }
        await transport.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse, req.body);
      } else {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });
        transport.onclose = () => {
          if (transport.sessionId) {
            transports.delete(transport.sessionId);
          }
        };
        const server = this.createServer();
        await server.connect(transport);
        await transport.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse, req.body);
        if (transport.sessionId) {
          transports.set(transport.sessionId, transport);
        }
      }
    });

    this.app.express.get("/mcp", async (req, res) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      const transport = sessionId ? transports.get(sessionId) : undefined;
      if (!transport) {
        res.status(400).end();
        return;
      }
      await transport.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);
    });

    this.app.express.delete("/mcp", async (req, res) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      const transport = sessionId ? transports.get(sessionId) : undefined;
      if (!transport) {
        res.status(400).end();
        return;
      }
      await transport.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);
    });
  }

  private async withPayment(accepts: X402Accepts) {
    const payments = await this.app.withPaymentRequirements(accepts);
    return createPaymentWrapper(this.app, {
      accepts: payments,
    });
  }

  async register<INPUT, OUTPUT>(
    name: string,
    exports: {
      default: Tool<INPUT, OUTPUT>;
      accepts: X402Accepts;
    },
  ) {
    const paid = await this.withPayment(exports.accepts);

    // TODO(@fuxingloh): add ext-app support:
    //  import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";

    const tool = exports.default;
    const config = {
      description: tool.description,
      ...(tool.inputSchema ? { inputSchema: (tool.inputSchema as any).shape } : {}),
    };
    this.registeredTools.push({
      name,
      config,
      handler: paid(async (args: Record<string, unknown>) => {
        try {
          const result = await tool.execute!(args as any, { toolCallId: name, messages: [], type: "tool-call" } as any);
          return {
            content: [
              {
                type: "text" as const,
                text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: ${error instanceof Error ? error.message : "An unknown error occurred"}`,
              },
            ],
            isError: true,
          };
        }
      }),
    });
  }
}
