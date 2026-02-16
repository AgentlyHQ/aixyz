import { AixyzMCP } from "aixyz/server/adapters/mcp";
import { AixyzServer } from "aixyz/server";
import { useA2A } from "aixyz/server/adapters/a2a";

import * as agent from "./agent";
import lookup from "./tools/lookup";

const server = new AixyzServer();
await server.initialize();

useA2A(server, agent);

const mcp = new AixyzMCP(server);
await mcp.register("latestData", {
  default: lookup,
  accepts: {
    scheme: "exact",
    price: "$0.001",
  },
});
await mcp.connect();

export default server;
