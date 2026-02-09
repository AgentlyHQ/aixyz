import { resolve } from "path";
import { loadEnvConfig } from "@next/env";

import type { AgentSkill as A2AAgentSkill } from "@a2a-js/sdk";
import { z } from "zod";

export type AgentSkill = A2AAgentSkill;

export type AixyzConfig = {
  name: string;
  description: string;
  /**
   * Version of the agent.
   */
  version: string;
  url?: string;
  x402?: {
    /**
     * The address that will receive the payment from the agent.
     * Defaults to `process.env.X402_PAY_TO` if not set.
     * Throws an error if neither is provided.
     */
    payTo?: string;
  };
  skills: AgentSkill[];
};

const cwd = process.cwd();

const AixyzSchema = z.object({
  name: z.string().nonempty(),
  description: z.string().nonempty(),
  version: z.string().nonempty(),
  url: z
    .string()
    .optional()
    .transform((val) => {
      if (val) {
        return val;
      }
      if (process.env.AIXYZ_BASE_URL) {
        return process.env.AIXYZ_BASE_URL;
      }

      if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}/`;
      }

      return `http://localhost:3000/`;
    })
    .pipe(z.url()),
  x402: z
    .object({
      payTo: z.string().optional(),
    })
    .optional()
    .transform((val) => {
      const payTo = val?.payTo ?? process.env.X402_PAY_TO;
      if (!payTo) {
        throw new Error(
          "x402.payTo is required. Set it in aixyz.config.ts or via the X402_PAY_TO environment variable.",
        );
      }
      return { payTo };
    }),
  skills: z.array(
    z.object({
      id: z.string().nonempty(),
      name: z.string().nonempty(),
      description: z.string().nonempty(),
      tags: z.array(z.string()),
      examples: z.array(z.string()).optional(),
      inputModes: z.array(z.string()).optional(),
      outputModes: z.array(z.string()).optional(),
      security: z.array(z.record(z.string(), z.array(z.string()))).optional(),
    }),
  ),
});

export type LoadedAixyzConfig = Omit<z.infer<typeof AixyzSchema>, "version"> & { version: string };

let singleton: LoadedAixyzConfig | undefined;

/**
 * Environment variables are looked up in the following places, in order, stopping once the variable is found.
 * 1. `process.env`
 * 2. `.env.$(NODE_ENV).local`
 * 3. `.env.local (Not checked when NODE_ENV is test.)`
 * 4. `.env.$(NODE_ENV)`
 * 5. `.env`
 *
 * For example, if `NODE_ENV` is `development` and you define a variable in both `.env.development.local` and `.env,
 * the value in `.env.development.local` will be used.
 */
export function loadAixyzConfig(): LoadedAixyzConfig {
  if (singleton) {
    return singleton;
  }

  loadEnvConfig(cwd);

  const configPath = resolve(cwd, "aixyz.config.ts");
  const mod = require(configPath);
  const config = mod.default;

  if (!config || typeof config !== "object") {
    throw new Error(`aixyz.config.ts must have a default export`);
  }

  const parsedConfig = AixyzSchema.safeParse(config);
  if (!parsedConfig.success) {
    throw new Error(`aixyz.config.ts: ${parsedConfig.error}`);
  }

  singleton = parsedConfig.data as LoadedAixyzConfig;
  return singleton;
}
