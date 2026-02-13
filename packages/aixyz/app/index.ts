import { DefaultRequestHandler, TaskStore, AgentExecutor } from "@a2a-js/sdk/server";
import { AgentCard } from "@a2a-js/sdk";
import { getAixyzConfig } from "../config";
import express from "express";
import { agentCardHandler, jsonRpcHandler, UserBuilder } from "@a2a-js/sdk/server/express";
import { RoutesConfig, x402ResourceServer } from "@x402/core/server";
import { paymentMiddleware } from "@x402/express";
import { getFacilitatorClient } from "../facilitator";
import type { ToolSet } from "ai";
import { ExactEvmScheme } from "@x402/evm/exact/server";

// TODO(@fuxingloh): add back x402 Bazaar compatibility

export function getAgentCard(): AgentCard {
  const config = getAixyzConfig();
  return {
    name: config.name,
    description: config.description,
    protocolVersion: "0.3.0",
    version: config.version,
    url: new URL("/agent", config.url).toString(),
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: config.skills,
  };
}

export class AixyzRequestHandler extends DefaultRequestHandler {
  constructor(taskStore: TaskStore, agentExecutor: AgentExecutor) {
    super(getAgentCard(), taskStore, agentExecutor);
  }
}

async function initX402ResourceServer() {
  const config = getAixyzConfig();
  const facilitator = getFacilitatorClient();
  const server = new x402ResourceServer(facilitator).register(config.x402.network as any, new ExactEvmScheme());

  await server.initialize();
  return server;
}

function getX402Routes(price: string): RoutesConfig {
  const config = getAixyzConfig();

  return {
    "POST /agent": {
      accepts: {
        scheme: "exact",
        price: price,
        network: config.x402.network as any,
        payTo: config.x402.payTo,
      },
      mimeType: "application/json",
      description: `A2A payment: ${config.description}`,
    },
    "POST /mcp": {
      accepts: {
        scheme: "exact",
        price: price,
        network: config.x402.network as any,
        payTo: config.x402.payTo,
      },
      mimeType: "application/json",
      description: `MCP payment: ${config.description}`,
    },
  };
}

export async function initApp(
  requestHandler: AixyzRequestHandler,
  price: string,
  options?: { tools?: ToolSet },
): Promise<express.Express> {
  const x402Server = await initX402ResourceServer();
  const app: express.Express = express();

  app.use(
    "/.well-known/agent-card.json",
    agentCardHandler({
      agentCardProvider: requestHandler,
    }),
  );

  const x402Routes = getX402Routes(price);
  app.use(paymentMiddleware(x402Routes, x402Server));
  app.use(
    "/agent",
    jsonRpcHandler({
      requestHandler,
      userBuilder: UserBuilder.noAuthentication,
    }),
  );

  if (options?.tools) {
    const { useMCP } = await import("./adapters/mcp.js");
    useMCP(app, options.tools);
  }

  return app;
}
