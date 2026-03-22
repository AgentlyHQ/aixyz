import { getAixyzConfigRuntime } from "@aixyz/config";
import { BasePlugin } from "../plugin";
import type { AixyzApp } from "../index";

/** Metadata plugin. Serves agent metadata at `/_aixyz/metadata.json`. */
export class MetadataPlugin extends BasePlugin {
  readonly name = "metadata";

  register(app: AixyzApp): void {
    const config = getAixyzConfigRuntime();
    const metadata = {
      name: config.name,
      description: config.description,
      version: config.version,
      skills: config.skills,
    };

    app.route("GET", "/_aixyz/metadata.json", () => Response.json(metadata));
  }
}
