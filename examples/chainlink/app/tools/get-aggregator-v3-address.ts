import { tool } from "ai";
import type { Accepts } from "aixyz/accepts";
import { z } from "zod";
import { normalize } from "viem/ens";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
});

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.00001",
};

export default tool({
  title: "Get Chainlink Aggregator V3 Address",
  description:
    "Resolve the on-chain contract address of a Chainlink AggregatorV3 price feed via ENS. Provide a symbol like 'eth', 'btc', 'link' and it returns the USD feed contract address.",
  inputSchema: z.object({
    symbol: z.string().describe("The cryptocurrency symbol to look up, e.g. 'eth', 'btc', 'link'"),
  }),
  outputSchema: z.string().describe("The contract address of the price feed"),
  execute: async (input) => {
    const ens = `${input.symbol.toLowerCase()}-usd.data.eth`;
    const address = await publicClient.getEnsAddress({
      name: normalize(ens),
    });

    if (!address) {
      throw new Error(
        `Could not resolve ENS name: ${ens}. Make sure '${input.symbol}' is a valid Chainlink price feed symbol.`,
      );
    }

    return address;
  },
});
