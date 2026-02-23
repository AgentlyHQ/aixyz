import { tool } from "ai";
import { z } from "zod";
import { fetchCoingeckoAPI } from "../utils/coingecko";

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

async function execute({ id, vsCurrency = "usd" }: z.infer<typeof GetTokenPriceInputSchema>) {
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

export const accepts = {
  scheme: "exact",
  price: "$0.01",
};

export default tool({
  title: "Token Price",
  description: "Get the current price for a token by CoinGecko id using /simple/price. Returns null if unavailable.",
  inputSchema: GetTokenPriceInputSchema,
  outputSchema: GetTokenPriceOutputSchema,
  execute,
});
