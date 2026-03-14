import { AixyzApp } from "aixyz/app";

import { IndexPagePlugin } from "aixyz/app/plugins/index-page";
import { A2APlugin } from "aixyz/app/plugins/a2a";
import { MCPPlugin } from "aixyz/app/plugins/mcp";
import { ERC8004Plugin } from "aixyz/app/plugins/erc-8004";
import { facilitator } from "aixyz/accepts";
import { experimental_StripePaymentIntentPlugin } from "@aixyz/stripe";

import * as agent from "./agent";
import * as searchFlights from "./tools/searchFlights";
import erc8004 from "./erc-8004";

const app = new AixyzApp({ facilitators: facilitator });
await app.withPlugin(new IndexPagePlugin());
await app.withPlugin(new experimental_StripePaymentIntentPlugin());
await app.withPlugin(new A2APlugin(agent));
await app.withPlugin(new MCPPlugin([{ name: "searchFlights", exports: searchFlights }]));
await app.withPlugin(
  new ERC8004Plugin({
    default: erc8004,
    options: {
      a2a: ["/.well-known/agent-card.json"],
      mcp: true,
    },
  }),
);
await app.initialize();

export default app;
