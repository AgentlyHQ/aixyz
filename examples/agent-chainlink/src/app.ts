import { AixyzMCP } from "aixyz/app/adapters/mcp";
import { AixyzApp } from "aixyz/app";
import { useA2A } from "aixyz/app/adapters/a2a";

import * as agent from "./agent";
import * as lookup from "./tools/lookup";

const app = new AixyzApp();
useA2A(app, agent);

const mcp = new AixyzMCP(app);
await mcp.register("lookup", lookup);
await mcp.connect();

await app.initialize();

export default app;
