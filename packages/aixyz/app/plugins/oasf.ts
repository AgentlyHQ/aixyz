import { getAixyzConfigRuntime } from "@aixyz/config";
import { BasePlugin } from "../plugin";
import type { AixyzApp } from "../index";

type OASFLocator = { type: string; urls: string[] };

/**
 * Build an OASF record from the runtime config and registered routes.
 */
export function getOasfRecord(app: AixyzApp) {
  const config = getAixyzConfigRuntime();
  const locators: OASFLocator[] = [];

  // Detect A2A agent card routes
  const a2aUrls: string[] = [];
  for (const key of app.routes.keys()) {
    const match = key.match(/^GET (\/.*\.well-known\/agent-card\.json)$/);
    if (match) a2aUrls.push(new URL(match[1], config.url).toString());
  }
  if (a2aUrls.length > 0) {
    locators.push({ type: "a2a", urls: a2aUrls });
  }

  // Detect MCP plugin
  if (app.getPlugin("mcp")) {
    locators.push({ type: "mcp", urls: [new URL("/mcp", config.url).toString()] });
  }

  // Map config services to locators
  for (const service of config.services ?? []) {
    locators.push({ type: service.type, urls: [service.url] });
  }

  // Map config skills with OASF catalog info to OASF skill format
  const skills = config.skills.filter((s) => s.oasf).map((s) => s.oasf!);

  return {
    name: config.name,
    description: config.description,
    version: config.version,
    schema_version: "1.0.0",
    authors: [],
    // NOTE: created_at is required by OASF schema, but not in aixyz config. We use transient value here since it doesn't make sense to persist it in the config file.
    created_at: new Date().toISOString(),
    domains: config.domains,
    skills,
    modules: [],
    locators,
  };
}

/** OASF identity plugin. Registers `GET /_aixyz/oasf.json`. */
export class OASFPlugin extends BasePlugin {
  readonly name = "oasf";
  private _record: ReturnType<typeof getOasfRecord> | undefined;

  register(app: AixyzApp): void {
    // Route registered eagerly; record computed in initialize() after all plugins are registered.
    app.route("GET", "/_aixyz/oasf.json", () => Response.json(this._record));
  }

  initialize(app: AixyzApp): void {
    this._record = getOasfRecord(app);
  }
}
