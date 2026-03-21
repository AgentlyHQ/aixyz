# {{AGENT_NAME}}

This is an [aixyz](https://github.com/AgentlyHQ/aixyz) agent project bootstrapped with [`create-aixyz-app`](https://github.com/AgentlyHQ/aixyz/tree/main/packages/create-aixyz-app).

## Getting Started

First, add your OpenAI API key to `.env.local`:

```bash
OPENAI_API_KEY=sk-...
```

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3000/.well-known/agent-card.json](http://localhost:3000/.well-known/agent-card.json) to see the agent card.

You can start editing the agent by modifying `app/agent.ts`. The server hot-reloads as you edit the file.

## Testing

Start the dev server:

```bash
bun run dev
```

Then in another terminal, use [use-agently](https://github.com/use-agently/cli) to interact with your agent via A2A:

```bash
bun use-agently a2a send --uri http://localhost:3000/ -m "Convert 100 meters to feet"
```

## Learn More

To learn more about aixyz, take a look at the following resources:

- [aixyz Documentation](https://aixyz.sh) — learn about aixyz features and API.
- [GitHub Repository](https://github.com/AgentlyHQ/aixyz) — source, issues, and examples.

## Deploy

Deploy your agent with [Vercel](https://vercel.com):

```bash
bun run build
vercel
```

Check out the [aixyz deployment documentation](https://aixyz.sh/getting-started/deploying) for more details.
