import { z } from "zod";

const COINGECKO_PRO_BASE_URL = "https://pro-api.coingecko.com/api/v3";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing environment variable: ${name}.`);
  }
  return v;
}

export async function fetchCoingeckoAPI<T>(path: string, schema: z.ZodSchema<T>, init?: RequestInit): Promise<T> {
  const apiKey = requireEnv("COINGECKO_PRO_API_KEY");

  const res = await fetch(`${COINGECKO_PRO_BASE_URL}${path}`, {
    method: "GET",
    ...init,
    headers: {
      accept: "application/json",
      "x-cg-pro-api-key": apiKey,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CoinGecko error (${res.status}): ${text || res.statusText}`);
  }

  const json = await res.json();
  return schema.parse(json);
}
