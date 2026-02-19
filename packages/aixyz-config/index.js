import { resolve } from "path";
import { loadEnvConfig } from "@next/env";
import { createRequire } from "node:module";
import { z } from "zod";
const NetworkSchema = z.custom((val) => {
  return typeof val === "string" && val.includes(":");
});
const AixyzConfigSchema = z.object({
  name: z.string().nonempty(),
  description: z.string().nonempty(),
  version: z.string().nonempty(),
  network: NetworkSchema,
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
    network: NetworkSchema.optional(),
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
export function getAixyzConfig() {
  const cwd = process.cwd();
  loadEnvConfig(cwd);
  const configPath = resolve(cwd, "aixyz.config.ts");
  const require = createRequire(import.meta.url);
  const mod = require(configPath);
  const config = mod.default;
  if (!config || typeof config !== "object") {
    throw new Error(`aixyz.config.ts must have a default export`);
  }
  const parsedConfig = AixyzConfigSchema.safeParse(config);
  if (!parsedConfig.success) {
    throw new Error(`aixyz.config.ts: ${parsedConfig.error}`);
  }
  return parsedConfig.data;
}
