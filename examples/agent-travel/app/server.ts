import { AixyzMCP } from "aixyz/server/adapters/mcp";
import { AixyzServer } from "aixyz/server";
import { useA2A } from "aixyz/server/adapters/a2a";
import { experimental_useStripePaymentIntent } from "@aixyz/stripe";

import * as agent from "./agent";
import * as searchFlights from "./tools/searchFlights";

const server = new AixyzServer();
await server.initialize();

await experimental_useStripePaymentIntent(server);
useA2A(server, agent);

const mcp = new AixyzMCP(server);
await mcp.register("searchFlights", searchFlights);
await mcp.connect();

export default server;
