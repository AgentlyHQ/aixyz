import { input } from "@inquirer/prompts";

export async function promptAgentId(): Promise<string> {
  return input({
    message: "Agent ID (token ID) to update:",
    validate: (value) => {
      const n = Number(value);
      if (value.trim() === "" || !Number.isInteger(n) || n < 0) return "Must be a non-negative integer";
      return true;
    },
  });
}

export async function promptUri(): Promise<string> {
  return input({
    message: "New agent metadata URI or path to .json file (leave empty to clear):",
  });
}
