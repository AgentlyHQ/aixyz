import { AixyzApp } from "aixyz/app";
import { IndexPagePlugin } from "aixyz/app/plugins/index-page";
import { A2APlugin } from "aixyz/app/plugins/a2a";
import { MCPPlugin } from "aixyz/app/plugins/mcp";
import { ERC8004Plugin } from "aixyz/app/plugins/erc-8004";
import { facilitator } from "aixyz/accepts";

import * as agent from "./agent";
import lookup from "./tools/lookup";
import erc8004 from "./erc-8004";

const server = new AixyzApp({ facilitators: facilitator });
await server.withPlugin(new IndexPagePlugin());
await server.withPlugin(new A2APlugin(agent));
await server.withPlugin(
  new MCPPlugin([
    {
      name: "latestData",
      exports: {
        default: lookup,
        accepts: {
          scheme: "exact",
          price: "$0.001",
        },
      },
    },
  ]),
);
await server.withPlugin(
  new ERC8004Plugin({
    default: erc8004,
    options: {
      a2a: ["/.well-known/agent-card.json"],
      mcp: true,
    },
  }),
);
await server.initialize();

export default server;
