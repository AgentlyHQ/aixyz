# Fake Model Agent

Demonstrates fully deterministic agent testing using `fake()` from `aixyz/model`. No API key is required — the fake model's transform function maps each user message to a predictable response, making every test fast, repeatable, and CI-safe.

The example agent checks whether a string is a palindrome, or reverses it if not.

## Quick Start

```bash
bun install

# Run tests (no API key needed)
bun test
```

## Project Structure

```
app/
├── agent.ts        # Agent using fake() model
└── agent.test.ts   # Fully deterministic test suite
```

## How It Works

```typescript
import { fake } from "aixyz/model";

export const model = fake((lastMessage, prompt) => {
  const reversed = [...lastMessage].reverse().join("");
  const isPalindrome = lastMessage.toLowerCase() === reversed.toLowerCase();
  const turn = prompt.filter((m) => m.role === "user").length;

  if (isPalindrome) return `"${lastMessage}" is a palindrome! (turn ${turn})`;
  return `"${lastMessage}" reversed is "${reversed}" (turn ${turn})`;
});
```

The transform receives:

- `lastMessage` — the text content of the last user turn
- `prompt` — the full conversation history

## Testing

```bash
bun test
```

All tests run without a network connection or API key:

```
✓ detects a palindrome
✓ reverses a non-palindrome
✓ tracks turn number from prompt context
✓ is deterministic — same input always gives same output
✓ finish reason is stop
```

## Running the Agent

```bash
bun run dev
```

| Endpoint                       | Description           |
| ------------------------------ | --------------------- |
| `/.well-known/agent-card.json` | A2A agent card        |
| `POST /agent`                  | A2A JSON-RPC endpoint |
