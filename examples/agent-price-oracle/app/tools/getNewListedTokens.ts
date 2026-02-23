import { tool } from "ai";
import { z } from "zod";
import { fetchCoingeckoAPI } from "../utils/coingecko";

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

async function execute() {
  const items = await fetchCoingeckoAPI("/coins/list/new", NewCoinsResponseSchema);
  return GetNewListedTokensOutputSchema.parse({
    items: items.slice(0, 5),
  });
}

export const accepts = {
  scheme: "exact",
  price: "$0.01",
};

export default tool({
  title: "Newly listed tokens",
  description: "Get newly listed tokens from CoinGecko Pro (id, symbol, name).",
  inputSchema: z.object({}),
  outputSchema: GetNewListedTokensOutputSchema,
  execute,
});
