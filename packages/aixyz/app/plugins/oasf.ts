import { getAixyzConfigRuntime } from "@aixyz/config";
import { BasePlugin } from "../plugin";
import type { AixyzApp } from "../index";
import { getAgentCard } from "./a2a";
import type { MCPPlugin } from "./mcp";

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
    modules: buildModules(app, config, a2aUrls),
    locators,
  };
}

/**
 * @see https://schema.oasf.outshift.com/1.0.0/module_categories for constants
 */
const OASF_A2A_MODULE = { name: "integration/a2a", id: 203 } as const;
const OASF_MCP_MODULE = { name: "integration/mcp", id: 202 } as const;

type OASFModule = { name: string; id: number; data: Record<string, unknown> };

function buildModules(
  app: AixyzApp,
  config: ReturnType<typeof getAixyzConfigRuntime>,
  a2aUrls: string[],
): OASFModule[] {
  const modules: OASFModule[] = [];

  // A2A module
  if (a2aUrls.length > 0) {
    modules.push({
      ...OASF_A2A_MODULE,
      data: {
        // TODO(kevin): read dynamically from a2a plugin exports instead of duplicating the same info here
        card_data: getAgentCard(),
        card_schema_version: "0.3.0",
      },
    });
  }

  // MCP module
  const mcpPlugin = app.getPlugin<MCPPlugin>("mcp");
  if (mcpPlugin) {
    // @see https://schema.oasf.outshift.com/1.0.0/objects/mcp_data for more format
    const data: Record<string, unknown> = {
      name: config.name,
      connections: [{ type: "streamable-http", url: new URL("/mcp", config.url).toString() }],
    };
    if (mcpPlugin.registeredTools?.length) {
      // @see https://schema.oasf.outshift.com/1.0.0/objects/mcp_server_tool for more format
      data.tools = mcpPlugin.registeredTools.map((t) => ({
        name: t.name,
        description: t.tool.description,
      }));
    }
    modules.push({ ...OASF_MCP_MODULE, data });
  }

  return modules;
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
