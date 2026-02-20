import { tool } from "ai";
import { z } from "zod";

export default tool({
  description: "Get current temperature for a city.",
  inputSchema: z.object({
    city: z.string().describe("City name (e.g. 'Tokyo')"),
  }),
  execute: async ({ city }) => {
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
    ).then((r) => r.json() as Promise<{ results?: { latitude: number; longitude: number }[] }>);

    const loc = geo.results?.[0];
    if (!loc) throw new Error(`Location '${city}' not found`);

    const weather = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m`,
    ).then((r) => r.json() as Promise<{ current: { temperature_2m: number } }>);

    return { city, temperature: weather.current.temperature_2m };
  },
});
