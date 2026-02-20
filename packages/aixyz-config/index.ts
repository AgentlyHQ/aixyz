import { resolve } from "path";

import { z } from "zod";

export type Network = `${string}:${string}`;

export type AixyzConfig = {
  name: string;
  description: string;
  /**
   * Version of the agent.
   */
  version: string;
  url?: string;
  x402: {
    /**
     * The address that will receive the payment from the agent.
     * Defaults to `process.env.X402_PAY_TO` if not set.
     * Throws an error if neither is provided.
     */
    payTo: string;
    /**
     * The x402 network to use for the agent.
     */
    network: string;
  };
  skills: GetAixyzConfig["skills"];
};

const NetworkSchema = z.custom<Network>((val) => {
  return typeof val === "string" && val.includes(":");
});

const AixyzConfigSchema = z.object({
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
      if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
        return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/`;
      }

      if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}/`;
      }

      return `http://localhost:3000/`;
    })
    .pipe(z.url()),
  x402: z.object({
    payTo: z.string(),
    network: NetworkSchema,
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

/**
 * This is the materialized config object that is cached for performance.
 * It is the result of parsing and validating the user's `aixyz.config.ts` file,
 * with environment variables loaded and applied.
 */
export type GetAixyzConfig = z.infer<typeof AixyzConfigSchema>;

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
 *
 * In production:
 * This is a materialized config object that is cached for performance.
 */
export function getAixyzConfig(): GetAixyzConfig {
  const cwd = process.cwd();
  const configPath = resolve(cwd, "aixyz.config.ts");
  const mod = require(configPath);
  const config = mod.default;

  if (!config || typeof config !== "object") {
    throw new Error(`aixyz.config.ts must have a default export`);
  }

  const parsedConfig = AixyzConfigSchema.safeParse(config);
  if (!parsedConfig.success) {
    throw new Error(`aixyz.config.ts: ${parsedConfig.error}`);
  }

  return parsedConfig.data as GetAixyzConfig;
}
