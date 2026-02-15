import { AixyzApp } from "aixyz/app";
import { useA2A } from "aixyz/app/adapters/a2a";
import { useMCP } from "aixyz/app/adapters/mcp";

import * as agent from "./agent";
import * as lookup from "./tools/lookup";

const app = await AixyzApp.init();
useA2A(app, agent);
// useMCP(app, lookup);

export default app;
