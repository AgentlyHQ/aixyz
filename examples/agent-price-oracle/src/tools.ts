import { tool } from "ai";
import { z } from "zod";

const COINGECKO_PRO_BASE_URL = "https://pro-api.coingecko.com/api/v3";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing environment variable: ${name}. ` +
        `Make sure it's set in your environment or in a .env file loaded by @next/env.`,
    );
  }
  return v;
}

async function fetchCoingeckoAPI<T>(path: string, schema: z.ZodSchema<T>, init?: RequestInit): Promise<T> {
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

// New Listed Tokens
const NewCoinsResponseSchema = z.array(
  z.object({
    id: z.string(),
    symbol: z.string(),
    name: z.string(),
  }),
);

const GetNewListedTokensOutputSchema = z.object({
  items: NewCoinsResponseSchema,
});

export type NewListedTokensOutput = z.infer<typeof GetNewListedTokensOutputSchema>;

export async function executeGetNewListedTokens(): Promise<NewListedTokensOutput> {
  const items = await fetchCoingeckoAPI("/coins/list/new", NewCoinsResponseSchema);
  return GetNewListedTokensOutputSchema.parse({
    items: items.slice(0, 5),
  });
}

export const getNewListedTokens = tool({
  title: "Newly listed tokens",
  description: "Get newly listed tokens from CoinGecko Pro (id, symbol, name).",
  inputSchema: z.object({}),
  outputSchema: GetNewListedTokensOutputSchema,
  execute: executeGetNewListedTokens,
});

// Token Price
const SimplePriceResponseSchema = z.record(z.string(), z.record(z.string(), z.number().or(z.null())));

const GetTokenPriceInputSchema = z.object({
  id: z.string().min(1).describe("CoinGecko token id, e.g. 'bitcoin', 'ethereum'."),
  vsCurrency: z.string().min(1).default("usd").describe("Fiat currency (CoinGecko vs_currency), e.g. 'usd'."),
});

const GetTokenPriceOutputSchema = z.object({
  id: z.string(),
  vsCurrency: z.string(),
  price: z.number().nullable(),
});

export type TokenPriceInput = z.infer<typeof GetTokenPriceInputSchema>;
export type TokenPriceOutput = z.infer<typeof GetTokenPriceOutputSchema>;

export async function executeGetTokenPrice({ id, vsCurrency = "usd" }: TokenPriceInput): Promise<TokenPriceOutput> {
  const vs = vsCurrency.trim().toLowerCase();
  const tokenId = id.trim();

  const json = await fetchCoingeckoAPI(
    `/simple/price?ids=${encodeURIComponent(tokenId)}&vs_currencies=${encodeURIComponent(vs)}`,
    SimplePriceResponseSchema,
  );

  const value = json?.[tokenId]?.[vs] ?? null;

  return GetTokenPriceOutputSchema.parse({
    id: tokenId,
    vsCurrency: vs,
    price: value,
  });
}

export const getTokenPrice = tool({
  title: "Token Price",
  description: "Get the current price for a token by CoinGecko id using /simple/price. Returns null if unavailable.",
  inputSchema: GetTokenPriceInputSchema,
  outputSchema: GetTokenPriceOutputSchema,
  execute: executeGetTokenPrice,
});

// Top Gainers & Losers
const TopGainersLosersItemSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  usd_24h_change: z.number(),
});

const TopGainersLosersResponseSchema = z.object({
  top_gainers: z.array(TopGainersLosersItemSchema),
  top_losers: z.array(TopGainersLosersItemSchema),
});

const GetTopGainersLosersOutputSchema = z.object({
  topGainers: z.array(
    z.object({
      name: z.string(),
      symbol: z.string(),
      change24h: z.number(),
    }),
  ),
  topLosers: z.array(
    z.object({
      name: z.string(),
      symbol: z.string(),
      change24h: z.number(),
    }),
  ),
});

export type TopGainersLosersOutput = z.infer<typeof GetTopGainersLosersOutputSchema>;

export async function executeGetTopGainersLosers(): Promise<TopGainersLosersOutput> {
  const data = await fetchCoingeckoAPI(
    "/coins/top_gainers_losers?vs_currency=usd&price_change_percentage=24H",
    TopGainersLosersResponseSchema,
  );

  return GetTopGainersLosersOutputSchema.parse({
    topGainers: data.top_gainers.slice(0, 5).map((item) => ({
      name: item.name,
      symbol: item.symbol,
      change24h: item.usd_24h_change,
    })),
    topLosers: data.top_losers.slice(0, 5).map((item) => ({
      name: item.name,
      symbol: item.symbol,
      change24h: item.usd_24h_change,
    })),
  });
}

export const getTopGainersLosers = tool({
  title: "Top Gainers & Losers",
  description:
    "Get the top gaining and losing tokens in the last 24 hours with their name, symbol, and 24h percentage change.",
  inputSchema: z.object({}),
  outputSchema: GetTopGainersLosersOutputSchema,
  execute: executeGetTopGainersLosers,
});
