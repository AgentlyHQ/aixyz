import { AixyzApp } from "aixyz/app";
import { IndexPagePlugin } from "aixyz/app/plugins/index-page";
import { MetadataPlugin } from "aixyz/app/plugins/metadata";
import { A2APlugin } from "aixyz/app/plugins/a2a";
import { MCPPlugin } from "aixyz/app/plugins/mcp";
import { facilitator } from "aixyz/accepts";

import * as agent from "./agent";
import * as putContent from "./tools/put-content";
import * as getContent from "./tools/get-content";
import { signerStorage } from "./session";

const app = new AixyzApp({ facilitators: facilitator });

// Middleware: extract x402 payer identity and set it in AsyncLocalStorage.
// Runs after PaymentGateway.verify() so getPayer() is available.
app.use(async (request, next) => {
  const payer = app.payment?.getPayer(request);
  if (payer) {
    return signerStorage.run(payer, next);
  }
  return next();
});

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
