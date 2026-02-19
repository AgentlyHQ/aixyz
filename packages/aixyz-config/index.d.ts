import { z } from "zod";
export type Network = `${string}:${string}`;
export type AixyzConfig = {
  name: string;
  description: string;
  /**
   * Version of the agent.
   */
  version: string;
  network: Network;
  url?: string;
  x402: {
    /**
     * The address that will receive the payment from the agent.
     * Defaults to `process.env.X402_PAY_TO` if not set.
     * Throws an error if neither is provided.
     */
    payTo: string;
    /**
     * The x402 network to use for the agent—separate from its identity.
     * Defaults to `process.env.X402_NETWORK`, followed by `network` config set on the root.
     */
    network?: string;
  };
  skills: GetAixyzConfig["skills"];
};
declare const AixyzConfigSchema: z.ZodObject<
  {
    name: z.ZodString;
    description: z.ZodString;
    version: z.ZodString;
    network: z.ZodCustom<`${string}:${string}`, `${string}:${string}`>;
    url: z.ZodPipe<z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<string, string | undefined>>, z.ZodURL>;
    x402: z.ZodObject<
      {
        payTo: z.ZodString;
        network: z.ZodOptional<z.ZodCustom<`${string}:${string}`, `${string}:${string}`>>;
      },
      z.core.$strip
    >;
    skills: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          name: z.ZodString;
          description: z.ZodString;
          tags: z.ZodArray<z.ZodString>;
          examples: z.ZodOptional<z.ZodArray<z.ZodString>>;
          inputModes: z.ZodOptional<z.ZodArray<z.ZodString>>;
          outputModes: z.ZodOptional<z.ZodArray<z.ZodString>>;
          security: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>>;
        },
        z.core.$strip
      >
    >;
  },
  z.core.$strip
>;
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
export declare function getAixyzConfig(): GetAixyzConfig;
export {};
