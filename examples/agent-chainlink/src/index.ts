import { InMemoryTaskStore } from "@a2a-js/sdk/server";
import { AixyzRequestHandler, initApp } from "aixyz/server";
import { ToolLoopAgentExecutor } from "aixyz/server/adapters/ai";
import { agent, x402 } from "./agent";

const requestHandler = new AixyzRequestHandler(new InMemoryTaskStore(), new ToolLoopAgentExecutor(agent));
const app = await initApp(requestHandler, x402.price, { tools: agent.tools });

export default app;
