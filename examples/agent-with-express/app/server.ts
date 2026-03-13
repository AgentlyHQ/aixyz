import express from "express";
import { AixyzApp } from "aixyz/app";
import { toExpress } from "aixyz/app/adapters/express";
import { IndexPagePlugin } from "aixyz/app/plugins/index-page";
import { A2APlugin } from "aixyz/app/plugins/a2a";
import { MCPPlugin } from "aixyz/app/plugins/mcp";

import { facilitator } from "./accepts";
import * as agent from "./agent";
import * as convertTemperature from "./tools/temperature";
import * as premiumTemperature from "./tools/premium-temperature";

// 1. Create AixyzApp with plugins
const app = new AixyzApp(facilitator ? { facilitators: facilitator } : undefined);
await app.withPlugin(new IndexPagePlugin());
await app.withPlugin(new A2APlugin(agent));
await app.withPlugin(
  new MCPPlugin([
    { name: "convertTemperature", exports: convertTemperature },
    { name: "premiumTemperature", exports: premiumTemperature },
  ]),
);
await app.initialize();

// 2. Mount on Express
const expressApp = express();

// Custom Express route (shows mixing Express + AixyzApp routes)
expressApp.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

expressApp.post("/echo", express.json(), (req, res) => {
  res.json(req.body);
});

// Mount AixyzApp — do NOT use express.json() before this
expressApp.use(toExpress(app));

// 3. Start server
const port = parseInt(process.env.PORT || "3000", 10);
expressApp.listen(port, () => {
  console.log(`Express server listening on http://localhost:${port}`);
});
