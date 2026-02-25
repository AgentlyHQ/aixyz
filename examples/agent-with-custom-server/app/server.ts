import { AixyzMCP } from "aixyz/server/adapters/mcp";
import { AixyzServer } from "aixyz/server";
import { useA2A } from "aixyz/server/adapters/a2a";
import { useERC8004 } from "aixyz/server/adapters/erc-8004";

import * as agent from "./agent";
import lookup from "./tools/lookup";
import erc8004 from "./erc-8004";

const server = new AixyzServer();
await server.initialize();
server.unstable_withIndexPage();

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

useERC8004(server, {
  default: erc8004,
  options: {
    a2a: true,
    mcp: true,
  },
});

export default server;
