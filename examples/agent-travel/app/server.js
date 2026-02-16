import { AixyzMCP } from "aixyz/server/adapters/mcp";
import { AixyzServer } from "aixyz/server";
import { useA2A } from "aixyz/server/adapters/a2a";
import { useStripe } from "aixyz/server/adapters/stripe";
import * as agent from "./agent";
import * as searchFlights from "./tools/searchFlights";
const server = new AixyzServer();
await server.initialize();
// Setup Stripe payment adapter if configured
const stripeMiddleware = useStripe(server, {
  enabled: !!process.env.STRIPE_SECRET_KEY,
  priceInCents: Number(process.env.STRIPE_PRICE_CENTS) || 100,
});
// Apply Stripe middleware before x402 middleware
server.express.use(stripeMiddleware);
useA2A(server, agent);
const mcp = new AixyzMCP(server);
await mcp.register("searchFlights", searchFlights);
await mcp.connect();
export default server;
