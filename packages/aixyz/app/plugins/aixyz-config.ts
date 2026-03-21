import { getAixyzConfigRuntime } from "@aixyz/config";
import { BasePlugin } from "../plugin";
import type { AixyzApp } from "../index";

/** Serves a limited subset of the agent config at `/.well-known/aixyz.json`. */
export class AixyzConfigPlugin extends BasePlugin {
  readonly name = "aixyz-config";

  register(app: AixyzApp): void {
    const config = getAixyzConfigRuntime();
    const file = {
      name: config.name,
      description: config.description,
      version: config.version,
      skills: config.skills,
    };

    app.route("GET", "/.well-known/aixyz.json", () => Response.json(file));
  }
}
