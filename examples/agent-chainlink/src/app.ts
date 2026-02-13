import { AixyzApp } from "aixyz/app";
import { useMCP } from "aixyz/app/adapters/mcp";
import { useA2A } from "aixyz/app/adapters/a2a";

import agent, { x402 } from "./agent";

const app = await AixyzApp.init();
useA2A(app, agent, x402);
useMCP(app.express, agent.tools);

export default app.express;
