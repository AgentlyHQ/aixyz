import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Travel Agent - Flight Search",
  description:
    "AI agent that finds the cheapest flights between multiple departure airports and destinations worldwide using real-time pricing data",
  version: "1.0.0",
  network: "eip155:84532",
  x402: {
    payTo: process.env.X402_PAY_TO || process.env.X402_PAYMENT_ADDRESS!,
    network: process.env.X402_NETWORK || "eip155:84532",
  },
  skills: [
    {
      id: "flight-search",
      name: "Cheapest Flight Search",
      description:
        "Search for the cheapest flights between airports with support for multiple departures, destinations, currencies, and trip types",
      tags: ["travel", "flights", "booking", "deals", "airlines"],
      examples: [
        "Find me the cheapest flights from Sao Paulo to Europe",
        "Search for flights from GRU and CWB to any destination",
        "What are the best flight deals from New York to Asia?",
        "Find roundtrip flights from LAX with at least 10 days trip length",
      ],
    },
  ],
};

export default config;
