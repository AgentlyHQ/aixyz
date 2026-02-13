import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { ToolLoopAgent, ToolSet } from "ai";
import express from "express";
import type { IncomingMessage, ServerResponse } from "node:http";
import { getAixyzConfig } from "../../config";
import { AixyzApp } from "../index";

/**
 * Registers all AI SDK tools onto an MCP server instance.
 */
export function registerAiToolsOnMcpServer(server: McpServer, tools: ToolSet): void {
  for (const [name, tool] of Object.entries(tools)) {
    const shape = (tool.inputSchema as any)?.shape;
    server.registerTool(
      name,
      {
        description: tool.description,
        ...(shape && Object.keys(shape).length > 0 ? { inputSchema: shape } : {}),
      } as any,
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.execute!(args, { toolCallId: name, messages: [], type: "tool-call" } as any);
          return {
            content: [
              {
                type: "text",
                text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error instanceof Error ? error.message : "An unknown error occurred"}`,
              },
            ],
            isError: true,
          };
        }
      },
    );
  }
}

/**
 * Mounts a stateless MCP endpoint on an Express app.
 * Creates a new McpServer per request, registers all AI SDK tools, and handles the transport lifecycle.
 */
export function useMCP<TOOLS extends ToolSet = ToolSet>(app: AixyzApp, agent: ToolLoopAgent<never, TOOLS>): void {
  const config = getAixyzConfig();
  app.express.post("/mcp", express.json(), async (req, res) => {
    const server = new McpServer({
      name: config.name,
      version: config.version,
    });
    registerAiToolsOnMcpServer(server, agent.tools);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
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
