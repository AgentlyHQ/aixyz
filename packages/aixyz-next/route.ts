/**
 * Re-exports from `@aixyz/next/route` — replaced at build time by the webpack alias
 * that `withAixyzConfig` sets up in `next.config.ts`.
 *
 * At runtime this file throws a helpful error if `withAixyzConfig` was not used.
 *
 * @see {@link withAixyzConfig}
 */
import type { NextRouteHandlers } from "./index";

const missingConfig = (): never => {
  throw new Error(
    "[@aixyz/next] @aixyz/next/route requires withAixyzConfig in your next.config.ts.\n" +
      "Add: import { withAixyzConfig } from '@aixyz/next'; export default withAixyzConfig({});",
  );
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export const GET: NextRouteHandlers["GET"] = missingConfig as any;
export const POST: NextRouteHandlers["POST"] = missingConfig as any;
export const PUT: NextRouteHandlers["PUT"] = missingConfig as any;
export const DELETE: NextRouteHandlers["DELETE"] = missingConfig as any;
export const PATCH: NextRouteHandlers["PATCH"] = missingConfig as any;
export const HEAD: NextRouteHandlers["HEAD"] = missingConfig as any;
export const OPTIONS: NextRouteHandlers["OPTIONS"] = missingConfig as any;
