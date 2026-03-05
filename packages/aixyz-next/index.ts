import type { NextConfig } from "next";
import { action as devAction } from "@aixyz/cli/dev";

interface WithAixyzOptions {
  dir?: string;
}

function getFreePort() {
  const server = Bun.serve({ port: 0, fetch: () => new Response() });
  const port = server.port!;
  void server.stop(true);
  return port;
}

export function withAixyz(nextConfig: NextConfig = {}, options?: WithAixyzOptions): NextConfig {
  const isDev = process.env.NODE_ENV === "development";
  const dir = options?.dir ?? "aixyz";

  if (isDev) {
    const aixyzPort = getFreePort();
    devAction({ port: String(aixyzPort), appDir: dir });

    return {
      ...nextConfig,
      rewrites: async () => {
        const existing = await nextConfig.rewrites?.();

        const aixyzRewrites = [{ source: "/_aixyz/:path*", destination: `http://localhost:${aixyzPort}/:path*` }];

        if (!existing) {
          return aixyzRewrites;
        }

        if (Array.isArray(existing)) {
          return [...existing, ...aixyzRewrites];
        }

        return {
          beforeFiles: existing.beforeFiles ?? [],
          afterFiles: [...(existing.afterFiles ?? []), ...aixyzRewrites],
          fallback: existing.fallback ?? [],
        };
      },
    };
  }

  return nextConfig;
}
