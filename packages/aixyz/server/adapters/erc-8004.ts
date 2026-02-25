import { z } from "zod";
import { getAixyzConfigRuntime } from "@aixyz/config";
import {
  ERC8004_REGISTRATION_TYPE,
  ServiceSchema,
  StrictAgentRegistrationFile,
  StrictAgentRegistrationFileSchema,
} from "@aixyz/erc-8004/schemas/registration";
import { AixyzServer } from "../index";

export function getAgentRegistrationFile(
  data: unknown,
  options: {
    mcp: boolean;
    a2a: boolean;
  },
): StrictAgentRegistrationFile {
  const config = getAixyzConfigRuntime();
  const services: StrictAgentRegistrationFile["services"] = [];

  if (options.a2a) {
    services.push({
      name: "A2A",
      endpoint: new URL("/agent", config.url).toString(),
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

  const withDefault = StrictAgentRegistrationFileSchema.extend({
    type: z.literal(ERC8004_REGISTRATION_TYPE).default(ERC8004_REGISTRATION_TYPE),
    name: z.string().default(config.name),
    description: z.string().default(config.description),
    image: z.string().default(new URL("/icon.png", config.url).toString()),
    services: z.array(ServiceSchema).min(1).default(services),
    active: z.boolean().default(true),
    x402support: z.boolean().default(true),
  });

  return withDefault.parse(data);
}

export function useERC8004(
  server: AixyzServer,
  exports: {
    default: unknown;
    options: {
      mcp: boolean;
      a2a: boolean;
    };
  },
): void {
  const file = getAgentRegistrationFile(exports.default, exports.options);

  // GET /_aixyz/erc-8004.json
  server.express.get("/_aixyz/erc-8004.json", (_req, res) => {
    res.json(file);
  });

  // GET /.well-known/erc-8004.json
  server.express.get("/.well-known/erc-8004.json", (_req, res) => {
    res.json(file);
  });
}
