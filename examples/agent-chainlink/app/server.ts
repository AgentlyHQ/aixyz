import { AixyzMCP } from "aixyz/server/adapters/mcp";
import { AixyzServer } from "aixyz/server";
import { useA2A } from "aixyz/server/adapters/a2a";

import * as agent from "./agent";
import * as lookup from "./tools/lookup";

const server = new AixyzServer();
await server.initialize();

useA2A(server, agent);

const mcp = new AixyzMCP(server);
await mcp.register("lookup", lookup);
await mcp.connect();

export default server;
