import { AixyzApp } from "aixyz/app";
import { useA2A } from "aixyz/app/adapters/a2a";
import { AixyzMCP, useMCP } from "aixyz/app/adapters/mcp";

import * as agent from "./agent";
import * as lookup from "./tools/lookup";

const app = await AixyzApp.init();
useA2A(app, agent);

const mcp = await AixyzMCP.init();
mcp.register(lookup);

useMCP(app, mcp);

export default app;
