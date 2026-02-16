import { AixyzMCP } from "aixyz/server/adapters/mcp";
import { AixyzServer } from "aixyz/server";
import { useA2A } from "aixyz/server/adapters/a2a";

import * as agent from "./agent";
import * as weather from "./tools/weather";

const server = new AixyzServer();
await server.initialize();

useA2A(server, agent);

const mcp = new AixyzMCP(server);
await mcp.register("weather", weather);
await mcp.connect();

export default server;
