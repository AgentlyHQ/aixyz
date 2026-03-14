import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Job Hunter - Career Scout Agent",
  description:
    "An AI agent that searches for remote job opportunities worldwide using the Jobicy API. Provides the latest remote job listings for specific countries.",
  version: "1.0.0",
  x402: {
    payTo: process.env.X402_PAY_TO!,
    network: process.env.X402_NETWORK!,
  },
  skills: [
    {
      id: "job-search",
      name: "Remote Job Search",
      description: "Search for the latest remote job opportunities in specific countries",
      tags: ["jobs", "remote", "career", "employment", "hiring"],
      examples: [
        "Find remote jobs in Canada",
        "Search for jobs in the USA",
        "What remote positions are available in the UK?",
      ],
    },
  ],
};

export default config;
