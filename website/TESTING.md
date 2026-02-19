# Testing the Documentation Site

## Prerequisites

The website requires the following dependencies to be installed:

- next@15.1.6
- nextra@4.0.11
- nextra-theme-docs@4.0.11
- react@19.0.0
- react-dom@19.0.0

## Installation

From the repository root:

```bash
bun install
```

If you encounter npm registry issues, try:

```bash
# Clear Bun cache
rm -rf ~/.bun/install/cache

# Try again
bun install
```

## Development

Start the development server:

```bash
cd website
bun run dev
```

Visit http://localhost:3000 to view the documentation.

## Build

Build for production:

```bash
cd website
bun run build
```

## Deployment

The website is configured to deploy to Vercel automatically. The root `vercel.json` points to the website directory.

## Structure

- `pages/index.mdx` - Single-page documentation
- `theme.config.tsx` - Nextra theme configuration
- `next.config.mjs` - Next.js configuration
- `vercel.json` - Vercel deployment configuration
- `turbo.json` - Turborepo configuration

## Notes

- The documentation is intentionally a single page (one-pager) to keep things simple
- All essential information is included on the index page
- The theme is configured with ai-xyz.dev branding
