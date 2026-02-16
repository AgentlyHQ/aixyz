# ai-xyz.dev Website

This is the official documentation website for ai-xyz.dev, built with Next.js 15 and Nextra 4.

## Tech Stack

- **Next.js 15.2.9** - Latest patched version (no known vulnerabilities)
- **Nextra 4** - Documentation theme
- **React 19** - UI library
- **TypeScript** - Type safety

## Setup

Install dependencies:

```bash
bun install
```

## Development

Run the development server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the documentation.

## Build

Build for production:

```bash
bun run build
```

## Deployment

This website is configured for deployment on Vercel. The deployment is automatically triggered when changes are pushed to the `main` branch.

### Vercel Configuration

The project includes a `vercel.json` configuration file at the root of the repository that specifies:

- Build command: `cd website && bun run build`
- Output directory: `website/.next`
- Dev command: `cd website && bun run dev`

## Project Structure

```
website/
├── pages/              # Documentation pages
│   ├── index.mdx       # Home page
│   ├── quickstart.mdx  # Quickstart guide
│   ├── installation.mdx
│   ├── configuration.mdx
│   ├── adapters.mdx
│   ├── cli.mdx
│   ├── protocols.mdx
│   └── _meta.json      # Sidebar navigation config
├── theme.config.tsx    # Nextra theme configuration
├── next.config.mjs     # Next.js configuration
├── package.json
└── tsconfig.json
```

## Adding New Pages

1. Create a new `.mdx` file in the `pages/` directory
2. Update `pages/_meta.json` to include the new page in the sidebar navigation

## License

MIT
