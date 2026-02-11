import { DefaultRequestHandler, TaskStore, AgentExecutor } from "@a2a-js/sdk/server";
import { AgentCard } from "@a2a-js/sdk";
import { loadAixyzConfig } from "../config";
import express from "express";
import { agentCardHandler, jsonRpcHandler, UserBuilder } from "@a2a-js/sdk/server/express";
import { RoutesConfig, x402ResourceServer } from "@x402/core/server";
import { paymentMiddleware } from "@x402/express";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { getFacilitatorClient } from "../facilitator";

// TODO(@fuxingloh): add back x402 Bazaar compatibility

export function getAgentCard(): AgentCard {
  const config = loadAixyzConfig();
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
  const config = loadAixyzConfig();
  const facilitator = getFacilitatorClient();
  let server = new x402ResourceServer(facilitator);
  server = registerExactEvmScheme(server, {
    networks: [config.x402.network as any],
  });

  await server.initialize();
  return server;
}

export async function initExpressApp(
  requestHandler: AixyzRequestHandler,
  x402Routes: RoutesConfig,
): Promise<express.Express> {
  const x402ResourceServer = await initX402ResourceServer();
  const app: express.Express = express();

  app.use(
    "/.well-known/agent-card.json",
    agentCardHandler({
      agentCardProvider: requestHandler,
    }),
  );

  // x402 Protected JSON-RPC endpoint
  app.use(paymentMiddleware(x402Routes, x402ResourceServer));
  app.use(
    "/agent",
    jsonRpcHandler({
      requestHandler,
      userBuilder: UserBuilder.noAuthentication,
    }),
  );
  return app;
}
