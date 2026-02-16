# Website Migration Summary

This document summarizes the migration of ai-xyz.dev documentation to a new Next.js + Nextra setup hosted in the `website/` directory.

## What Was Created

### Directory Structure

```
website/
├── pages/                    # Documentation pages (MDX)
│   ├── index.mdx            # Home page
│   ├── quickstart.mdx       # Getting started guide
│   ├── installation.mdx     # Installation instructions
│   ├── configuration.mdx    # Configuration reference
│   ├── adapters.mdx         # Framework adapters
│   ├── cli.mdx              # CLI commands
│   ├── protocols.mdx        # Protocol documentation (A2A, MCP, x402, ERC-8004)
│   ├── deployment.mdx       # Deployment guide
│   ├── examples.mdx         # Example projects
│   ├── contributing.mdx     # Contributing guide
│   ├── _meta.json           # Sidebar navigation config
│   └── _app.tsx             # Next.js app wrapper
├── public/                  # Static assets (empty for now)
├── next.config.mjs          # Next.js configuration with Nextra
├── theme.config.tsx         # Nextra theme configuration
├── tsconfig.json            # TypeScript configuration
├── package.json             # Dependencies and scripts
├── .eslintrc.json           # ESLint configuration
├── .gitignore               # Git ignore rules
├── .env.example             # Environment variables example
└── README.md                # Website-specific README
```

### Configuration Files

1. **package.json** - Next.js 15.0.8+ (patched) + Nextra 4 + React 19
2. **next.config.mjs** - Nextra integration with standalone output
3. **theme.config.tsx** - Documentation theme with branding
4. **tsconfig.json** - TypeScript configuration for Next.js
5. **vercel.json** (root) - Vercel deployment configuration

### Documentation Pages

All major documentation sections have been created:

- **Introduction** - Overview and features
- **Quickstart** - Step-by-step getting started guide
- **Installation** - Installation methods and project structure
- **Configuration** - Complete configuration reference
- **Adapters** - Framework adapters (Vercel AI SDK, LangChain, Mastra)
- **CLI Commands** - Command-line tools
- **Protocols** - A2A, MCP, x402, and ERC-8004 documentation
- **Deployment** - Vercel, Docker, and other deployment options
- **Examples** - Repository examples with code snippets
- **Contributing** - Contribution guidelines

### Content Migration

Content was migrated from the root README.md to organized documentation pages:

- Quickstart guide expanded with more details
- Configuration split into its own dedicated page
- Protocols explained in depth with examples
- New deployment guide added
- Examples documented with locations and features
- Contributing guide added with development workflow

## Integration with Monorepo

1. **Workspace** - Added `website` to root `package.json` workspaces
2. **Turbo** - Updated `turbo.json` to include Next.js build inputs/outputs
3. **Git** - Added `.gitignore` for Next.js build artifacts

## Vercel Deployment

The `vercel.json` file at the repository root configures:

- Build command: `cd website && bun run build`
- Output directory: `website/.next`
- Dev command: `cd website && bun run dev`
- Install command: `bun install`

## Next Steps

Once dependencies are installed successfully:

1. **Local Development**

   ```bash
   cd website
   bun install
   bun run dev
   ```

2. **Build**

   ```bash
   cd website
   bun run build
   ```

3. **Deploy to Vercel**
   - Connect GitHub repository to Vercel
   - Vercel will auto-detect the configuration
   - Automatic deployments on push to main

## Benefits

1. **Better Documentation** - Organized, searchable, with navigation
2. **Modern Stack** - Next.js 14 + Nextra for great developer experience
3. **Vercel Optimized** - Native support for serverless deployment
4. **Maintainable** - MDX files for easy content updates
5. **Scalable** - Easy to add new pages and sections

## Technical Decisions

- **Next.js 15.0.8+** - Patched version that fixes DoS vulnerability (CVE related to HTTP request deserialization)
- **Nextra 4** - Latest Nextra compatible with Next.js 15
- **React 19** - Required for Next.js 15
- **Standalone Output** - Optimized for serverless deployment
- **Bun** - Consistent with the rest of the monorepo

## Notes

- Dependencies require working npm registry access for installation
- The structure follows Next.js and Nextra best practices
- All documentation is in MDX format for flexibility
- Theme can be customized in `theme.config.tsx`
