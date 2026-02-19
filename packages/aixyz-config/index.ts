import { existsSync, readFileSync } from "fs";
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

type LoadedEnvFile = {
  path: string;
};

type LoadEnvConfigResult = {
  loadedEnvFiles: LoadedEnvFile[];
};

function parseEnvFile(contents: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2] ?? "";

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "");
    }

    value = value.replace(/\\n/g, "\n");
    values[key] = value;
  }

  return values;
}

export function loadEnvConfig(cwd: string, _dev?: boolean): LoadEnvConfigResult {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const envFiles = [
    ".env",
    `.env.${nodeEnv}`,
    nodeEnv === "test" ? null : ".env.local",
    `.env.${nodeEnv}.local`,
  ].filter(Boolean) as string[];
  const loadedEnvFiles: LoadedEnvFile[] = [];
  const originalEnvKeys = new Set(Object.keys(process.env));

  for (const envFile of envFiles) {
    const envPath = resolve(cwd, envFile);
    if (!existsSync(envPath)) {
      continue;
    }

    const contents = readFileSync(envPath, "utf8");
    const parsed = parseEnvFile(contents);
    for (const [key, value] of Object.entries(parsed)) {
      if (originalEnvKeys.has(key)) {
        continue;
      }
      process.env[key] = value;
    }
    loadedEnvFiles.push({ path: envPath });
  }

  return { loadedEnvFiles };
}

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
  loadEnvConfig(cwd);

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
