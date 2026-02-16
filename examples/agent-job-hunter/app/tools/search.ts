import { tool } from "ai";
import { z } from "zod";

const JOBICY_BASE_URL = "https://jobicy.com/api/v2/remote-jobs";

const JobSchema = z.object({
  id: z.number(),
  url: z.string(),
  jobTitle: z.string(),
  companyName: z.string(),
  jobIndustry: z.array(z.string()),
  jobGeo: z.string(),
  jobLevel: z.string(),
  pubDate: z.string(),
});

const JobicyResponseSchema = z.object({
  jobs: z.array(JobSchema),
});

/**
 * Execute the job search
 */
async function executeJobSearch({ geo }: { geo: string }) {
  const url = `${JOBICY_BASE_URL}?count=5&geo=${encodeURIComponent(geo.toLowerCase().trim())}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Jobicy API error: ${response.statusText}`);
  }

  const data = await response.json();
  return JobicyResponseSchema.parse(data);
}

export const accepts = {
  price: "$0.01",
};

export default tool({
  title: "Search Remote Jobs",
  description: "Fetch the latest remote jobs from Jobicy for a specific country (geo).",
  inputSchema: z.object({
    geo: z.string().describe("The country or region to search for (e.g., 'canada', 'usa', 'uk')."),
  }),
  outputSchema: z.object({
    jobs: z.array(JobSchema).describe("Array of job listings"),
  }),
  execute: executeJobSearch,
});
