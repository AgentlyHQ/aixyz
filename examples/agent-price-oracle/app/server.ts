import { AixyzMCP } from "aixyz/server/adapters/mcp";
import { AixyzServer } from "aixyz/server";
import { useA2A } from "aixyz/server/adapters/a2a";

import * as agent from "./agent";
import * as getNewListedTokens from "./tools/getNewListedTokens";
import * as getTokenPrice from "./tools/getTokenPrice";
import * as getTopGainersLosers from "./tools/getTopGainersLosers";

const server = new AixyzServer();
await server.initialize();

useA2A(server, agent);

const mcp = new AixyzMCP(server);
await mcp.register("getNewListedTokens", getNewListedTokens);
await mcp.register("getTokenPrice", getTokenPrice);
await mcp.register("getTopGainersLosers", getTopGainersLosers);
await mcp.connect();

export default server;
