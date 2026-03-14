import { tool } from "ai";
import { z } from "zod";
import { fetchCoingeckoAPI } from "../utils/coingecko";

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

async function execute() {
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

export const accepts = {
  scheme: "exact",
  price: "$0.01",
};

export default tool({
  title: "Top Gainers & Losers",
  description:
    "Get the top gaining and losing tokens in the last 24 hours with their name, symbol, and 24h percentage change.",
  inputSchema: z.object({}),
  outputSchema: GetTopGainersLosersOutputSchema,
  execute,
});
