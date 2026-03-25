import { AixyzApp } from "aixyz/app";
import { IndexPagePlugin } from "aixyz/app/plugins/index-page";
import { MetadataPlugin } from "aixyz/app/plugins/metadata";
import { A2APlugin } from "aixyz/app/plugins/a2a";
import { MCPPlugin } from "aixyz/app/plugins/mcp";
import { SessionPlugin } from "aixyz/app/plugins/session";
import { facilitator } from "./accepts";

import * as agent from "./agent";
import * as putContent from "./tools/put-content";
import * as getContent from "./tools/get-content";

const app = new AixyzApp({ facilitators: facilitator });

// SessionPlugin must be registered first so its middleware runs before other handlers.
await app.withPlugin(new SessionPlugin());
await app.withPlugin(new IndexPagePlugin());
await app.withPlugin(new MetadataPlugin());
await app.withPlugin(new A2APlugin([{ exports: agent }]));
await app.withPlugin(
  new MCPPlugin([
    { name: "put-content", exports: putContent },
    { name: "get-content", exports: getContent },
  ]),
);
await app.initialize();

export default app;
