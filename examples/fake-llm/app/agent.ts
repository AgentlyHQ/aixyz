import { fake } from "aixyz/model";
import { ToolLoopAgent } from "ai";

/**
 * A palindrome-checker model powered by `fake()`.
 *
 * The transform receives the last user message and the full prompt history.
 * It uses both to produce a deterministic response — no API key required.
 */
export const model = fake((lastMessage, prompt) => {
  const reversed = [...lastMessage].reverse().join("");
  const isPalindrome = lastMessage.toLowerCase() === reversed.toLowerCase();
  const turn = prompt.filter((m) => m.role === "user").length;

  if (isPalindrome) {
    return `"${lastMessage}" is a palindrome! (turn ${turn})`;
  }
  return `"${lastMessage}" reversed is "${reversed}" (turn ${turn})`;
});

export default new ToolLoopAgent({
  model,
  instructions: "You analyze text for palindromes and reverse it when asked.",
});
