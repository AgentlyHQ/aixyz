import { z } from "zod";
import { getAixyzConfigRuntime } from "@aixyz/config";
import {
  AgentRegistrationFile,
  AgentRegistrationFileSchema,
  ERC8004_REGISTRATION_TYPE,
  ServiceSchema,
} from "@aixyz/erc-8004/schemas/registration";
import { BasePlugin } from "../plugin";
import type { AixyzApp } from "../index";

/**
 * Build an ERC-8004 agent registration file by merging user-provided data with
 * runtime config defaults (name, description, image, services, etc.).
 */
export function getAgentRegistrationFile(
  data: unknown,
  options: { mcp: boolean; a2a: string[] },
): AgentRegistrationFile {
  const config = getAixyzConfigRuntime();
  const services: AgentRegistrationFile["services"] = [];

  for (const path of options.a2a) {
    services.push({
      name: "A2A",
      endpoint: new URL(path, config.url).toString(),
      version: "0.3.0",
    });
  }

  if (options.mcp) {
    services.push({
      name: "MCP",
      endpoint: new URL("/mcp", config.url).toString(),
      version: "2025-06-18",
    });
  }

  const withDefault = AgentRegistrationFileSchema.extend({
    type: z.literal(ERC8004_REGISTRATION_TYPE).default(ERC8004_REGISTRATION_TYPE),
    name: z.string().default(config.name),
    description: z.string().default(config.description),
    image: z.string().default(new URL("/icon.png", config.url).toString()),
    services: z.array(ServiceSchema).default(services),
    active: z.boolean().default(true),
    x402support: z.boolean().default(true),
  });

  return withDefault.parse(data);
}

/** ERC-8004 identity plugin. Registers the `/_aixyz/erc-8004.json` route. */
export class ERC8004Plugin extends BasePlugin {
  readonly name = "erc-8004";

  constructor(private exports: { default: unknown; options: { mcp: boolean; a2a: string[] } }) {
    super();
  }

  register(app: AixyzApp): void {
    const file = getAgentRegistrationFile(this.exports.default, this.exports.options);

    app.route("GET", "/_aixyz/erc-8004.json", () => Response.json(file));
  }
}
