import { resolve } from "path";

import { z } from "zod";

export type Network = `${string}:${string}`;

export type AixyzConfig = {
  /**
   * The name of the agent will be used in the agent card.
   */
  name: string;
  /**
   * A short description of the agent.
   * This will be used in the agent card.
   */
  description: string;
  /**
   * Version of the agent.
   */
  version: string;
  /**
   * The URL of the agent, required for canonical urls.
   * Defaults to `process.env.VERCEL_URL` for Vercel deployments.
   */
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
  build?: {
    /**
     * Output format for `aixyz build`.
     * - `"standalone"`: Bundles into a single executable file (default).
     * - `"vercel"`: Generates Vercel Build Output API v3 structure.
     * Overrides the `VERCEL=1` environment variable, but is overridden by the `--output` CLI flag.
     */
    output?: "standalone" | "vercel";
    /**
     * Glob pattern(s) for files to include in the build from the `app/` directory.
     * @default ["**\/*.{js,jsx,ts,tsx}"]
     */
    includes?: string | string[];
    /**
     * Glob pattern(s) for files to exclude from the build.
     * @default ["**\/{_*,*.{test,spec,e2e}}.{js,jsx,ts,tsx}"]
     */
    excludes?: string | string[];
  };
  skills?: InferredAixyzConfig["skills"];
};

const NetworkSchema = z.custom<Network>((val) => {
  return typeof val === "string" && val.includes(":");
});

const defaultConfig = {
  build: {
    includes: ["**/*.{js,jsx,ts,tsx}"],
    excludes: ["**/{_*,*.{test,spec,e2e}}.{js,jsx,ts,tsx}"],
  },
  skills: [],
};

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
  build: z
    .object({
      output: z.enum(["standalone", "vercel"]).optional(),
      includes: z
        .union([z.string(), z.array(z.string())])
        .default(["**/*.{js,jsx,ts,tsx}"])
        .transform((v) => (Array.isArray(v) ? v : [v])),
      excludes: z
        .union([z.string(), z.array(z.string())])
        .default(["**/{_*,*.{test,spec,e2e}}.{js,jsx,ts,tsx}"])
        .transform((v) => (Array.isArray(v) ? v : [v])),
    })
    .default(defaultConfig.build),
  skills: z
    .array(
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
    )
    .default(defaultConfig.skills),
});

type InferredAixyzConfig = z.infer<typeof AixyzConfigSchema>;

/**
 * Subset of `AixyzConfig` that is expose and materialized at runtime.
 *
 * This is the materialized config object that is cached for performance.
 * It is the result of parsing and validating the user's `aixyz.config.ts` file,
 * with environment variables loaded and applied.
 */
export type AixyzConfigRuntime = {
  name: AixyzConfig["name"];
  description: AixyzConfig["description"];
  version: AixyzConfig["version"];
  url: AixyzConfig["url"];
  skills: NonNullable<AixyzConfig["skills"]>;
};

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
 *
 * @deprecated Use `getAixyzConfigRuntime()` instead, which is designed for runtime use.
 * This will be deprecated in the next major version—when we materialize the config for downstream.
 */
export function getAixyzConfig(): InferredAixyzConfig {
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

  return parsedConfig.data as InferredAixyzConfig;
}

/**
 * Returns the subset of `aixyz.config.ts` that is safe to expose at runtime.
 * Unlike `getAixyzConfig()`, which is intended for the build/CLI phase only,
 * this function is designed to be available in the deployed runtime bundle.
 */
export function getAixyzConfigRuntime(): AixyzConfigRuntime {
  const config = getAixyzConfig();
  return {
    name: config.name,
    description: config.description,
    version: config.version,
    url: config.url,
    skills: config.skills,
  };
}
