import { tool } from "ai";
import { z } from "zod";
import { normalize } from "viem/ens";
import { Address, createPublicClient, getContract, http } from "viem";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
});

const AggregatorV3InterfaceABI = [
  {
    type: "function",
    name: "latestRoundData",
    inputs: [],
    outputs: [
      { internalType: "uint80", name: "roundId", type: "uint80" },
      { internalType: "int256", name: "answer", type: "int256" },
      { internalType: "uint256", name: "startedAt", type: "uint256" },
      { internalType: "uint256", name: "updatedAt", type: "uint256" },
      { internalType: "uint80", name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
  },
] as const;

function getAggregatorV3Contract(address: Address) {
  return getContract({
    address,
    abi: AggregatorV3InterfaceABI,
    client: publicClient,
  });
}

/**
 * Execute the Chainlink price lookup
 */
export async function executeLookup({ symbol }: { symbol: string }) {
  const ens = `${symbol.toLowerCase()}-usd.data.eth`;
  const address = await publicClient.getEnsAddress({
    name: normalize(ens),
  });

  if (!address) {
    throw new Error(
      `Could not resolve ENS name: ${ens}. Make sure '${symbol}' is a valid Chainlink price feed symbol.`,
    );
  }

  const contract = getAggregatorV3Contract(address);
  const [roundData, decimals] = await Promise.all([contract.read.latestRoundData(), contract.read.decimals()]);

  // Normalize the price by dividing by 10^decimals
  const rawPrice = roundData[1];
  const divisor = BigInt(10 ** Number(decimals));
  const normalizedPrice = Number(rawPrice) / Number(divisor);

  return {
    symbol,
    ens,
    address,
    price: normalizedPrice.toFixed(2),
    roundId: roundData[0].toString(),
    updatedAt: roundData[3].toString(),
    startedAt: roundData[2].toString(),
    answeredInRound: roundData[4].toString(),
  };
}

export default tool({
  title: "Lookup Chainlink Price Feed",
  description:
    "Get the latest price data from Chainlink price feeds for cryptocurrency prices in USD. Provide a symbol like 'eth', 'btc', 'link' and it will look up the USD price feed.",
  inputSchema: z.object({
    symbol: z
      .string()
      .describe(
        "The cryptocurrency symbol to look up, e.g. 'eth', 'btc', 'link'. Will be converted to {symbol}-usd.data.eth format.",
      ),
  }),
  outputSchema: z.object({
    symbol: z.string().describe("The original symbol queried"),
    ens: z.string().describe("The ENS name used for the lookup"),
    address: z.string().describe("The contract address of the price feed"),
    price: z.string().describe("The latest price in USD (normalized to actual value)"),
    roundId: z.string().describe("The round ID of the latest data"),
    updatedAt: z.string().describe("The timestamp when the price was last updated"),
    startedAt: z.string().describe("The timestamp when the round started"),
    answeredInRound: z.string().describe("The round ID in which the answer was computed"),
  }),
  execute: executeLookup,
});
