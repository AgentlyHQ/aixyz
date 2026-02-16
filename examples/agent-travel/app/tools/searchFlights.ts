import { tool } from "ai";
import { z } from "zod";

const SKYCENTS_API_URL = "https://opinalink-server-312266033746.southamerica-east1.run.app/skycents/search";

// Common IATA codes for reference
export const POPULAR_DESTINATIONS = [
  "ATL",
  "LAX",
  "ORD",
  "DFW",
  "DEN",
  "LHR",
  "CDG",
  "AMS",
  "FRA",
  "IST",
  "GRU",
  "BOG",
  "LIM",
  "GIG",
  "SCL",
  "PEK",
  "HND",
  "SIN",
  "HKG",
  "ICN",
  "SYD",
  "MEL",
  "BNE",
  "AKL",
  "PER",
];

// Flight result schema
const FlightResultSchema = z.object({
  departureCode: z.string().describe("IATA code of the departure airport"),
  departingAirport: z.string().describe("Full name and location of the departure airport"),
  destinationCode: z.string().describe("IATA code of the destination airport"),
  destinationAirport: z.string().describe("Full name and location of the destination airport"),
  price: z.number().describe("Flight price in the specified currency"),
  link: z.string().describe("Direct link to book this flight on Skyscanner"),
  discount: z.number().describe("Discount percentage from average price"),
  goDate: z.string().describe("Departure date in YYYY-MM-DD format"),
  priceHistory: z.array(z.number()).describe("Historical prices for this route"),
  avgMonth: z.number().describe("Average price for this month"),
  Month: z.string().describe("Month of travel in YYYY-MM format"),
  analyzedFares: z.number().describe("Number of fares analyzed"),
  tripType: z.string().describe("Type of trip (Roundtrip or Oneway)"),
  backDate: z.string().describe("Return date in YYYY-MM-DD format"),
  tripLength: z.number().describe("Length of the trip in days"),
});

// Input schema for the search
const SearchInputSchema = z.object({
  departures: z.array(z.string()).min(1).describe("Array of departure airport IATA codes (e.g., ['GRU', 'CWB'])"),
  destinations: z
    .array(z.string())
    .optional()
    .describe("Array of destination airport IATA codes. If not provided, uses popular destinations."),
  language: z.string().optional().default("en-US").describe("Language for the response (default: en-US)"),
  currency: z.string().optional().default("USD").describe("Currency for prices (default: USD)"),
  tripType: z
    .enum(["roundtrip", "oneway"])
    .optional()
    .default("roundtrip")
    .describe("Type of trip: roundtrip or oneway (default: roundtrip)"),
  minTripLength: z.number().optional().default(5).describe("Minimum trip length in days (default: 5)"),
  startDate: z.string().nullable().optional().describe("Start date for search range (YYYY-MM-DD format)"),
  endDate: z.string().nullable().optional().describe("End date for search range (YYYY-MM-DD format)"),
});

type FlightResult = z.infer<typeof FlightResultSchema>;

interface SearchResponse {
  results: FlightResult[];
}

export interface SearchFlightsInput {
  departures: string[];
  destinations?: string[];
  language?: string;
  currency?: string;
  tripType?: "roundtrip" | "oneway";
  minTripLength?: number;
  startDate?: string | null;
  endDate?: string | null;
}

/**
 * Execute the flight search against the Skycents API
 */
export async function executeSearchFlights(input: SearchFlightsInput): Promise<SearchResponse> {
  const payload = {
    departures: input.departures,
    destinations: input.destinations ?? POPULAR_DESTINATIONS,
    language: input.language ?? "en-US",
    currency: input.currency ?? "USD",
    tripType: input.tripType ?? "roundtrip",
    minTripLength: input.minTripLength ?? 5,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
  };

  const response = await fetch(SKYCENTS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Flight search API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as SearchResponse;

  if (!data.results || !Array.isArray(data.results)) {
    throw new Error("Invalid response format from flight search API");
  }

  return data;
}

const searchFlights = tool({
  title: "Search Cheapest Flights",
  description:
    "Search for the cheapest flights between multiple departure airports and destinations. Returns flight deals with prices, dates, discounts, and booking links. Use IATA airport codes (e.g., GRU for Sao Paulo, LAX for Los Angeles).",
  inputSchema: SearchInputSchema,
  outputSchema: z.object({
    results: z.array(FlightResultSchema).describe("Array of flight results sorted by price"),
  }),
  execute: executeSearchFlights,
});

export const accepts = {
  price: "$0.01",
};

export default searchFlights;
