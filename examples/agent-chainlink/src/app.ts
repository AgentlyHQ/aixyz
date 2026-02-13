import agent, { x402 } from "./agent";
import { AixyzApp } from "aixyz/app";
import { useA2A } from "aixyz/app/adapters/a2a";
import { useMCP } from "aixyz/app/adapters/mcp";

const app = await AixyzApp.init();
useA2A(app, agent, x402);
useMCP(app, agent);

export default app;
