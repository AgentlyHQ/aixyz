import { AixyzMCP } from "aixyz/server/adapters/mcp";
import { AixyzServer } from "aixyz/server";
import { useA2A } from "aixyz/server/adapters/a2a";
import { useERC8004 } from "aixyz/server/adapters/erc-8004";
import { experimental_useStripePaymentIntent } from "@aixyz/stripe";

import * as agent from "./agent";
import * as searchFlights from "./tools/searchFlights";
import erc8004 from "./erc-8004";

const server = new AixyzServer();
await server.initialize();
server.unstable_withIndexPage();

experimental_useStripePaymentIntent(server);
useA2A(server, agent);

const mcp = new AixyzMCP(server);
await mcp.register("searchFlights", searchFlights);
await mcp.connect();

useERC8004(server, {
  default: erc8004,
  options: {
    a2a: true,
    mcp: true,
  },
});

export default server;
