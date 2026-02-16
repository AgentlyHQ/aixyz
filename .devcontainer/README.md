# GitHub Codespaces Configuration

This directory contains the devcontainer configuration for developing aixyz with GitHub Codespaces.

## Features

- **Pre-built Bun Image**: Uses the official Bun 1.3.9 Docker image for fast setup
- **Git & GitHub CLI**: Pre-installed for version control and GitHub operations
- **Node.js LTS**: Installed for compatibility with tools that require Node.js
- **VS Code Extensions**: Automatically installs recommended extensions for TypeScript/Bun development
- **Auto-formatting**: Prettier runs on save to maintain code style consistency
- **Port Forwarding**: Automatically forwards ports 3000-3002 for local development

## Usage

### Starting a Codespace

1. Navigate to the repository on GitHub
2. Click the **Code** button
3. Select the **Codespaces** tab
4. Click **Create codespace on main** (or your current branch)

The devcontainer will automatically:

- Pull the Bun 1.3.9 image
- Install all required features and tools
- Run `bun install` to install dependencies
- Configure VS Code with recommended extensions and settings

### Available Commands

Once your Codespace is running, you can use all the standard commands:

```bash
bun install           # Install dependencies
bun run dev          # Start development servers
bun run build        # Build all packages
bun run test         # Run tests
bun run lint         # Lint and auto-fix code
bun run format       # Format code with Prettier
bun run clean        # Clean build artifacts
```

### Port Forwarding

The devcontainer automatically forwards these ports:

- **3000**: Main application
- **3001**: Development server
- **3002**: Additional services

These will be automatically detected and made available in VS Code's Ports panel.

## Pre-builds

To enable pre-builds for faster Codespace startup:

1. Go to your repository settings
2. Navigate to **Code & automation** > **Codespaces**
3. Click **Set up prebuild**
4. Configure the prebuild to run on push to main/master branch
5. Select the regions where you want pre-builds available

Pre-builds will cache the container image and `bun install` results, making new Codespaces start in seconds instead of minutes.

## Customization

You can customize the devcontainer configuration by editing `.devcontainer/devcontainer.json`:

- **Add VS Code extensions**: Add extension IDs to the `extensions` array
- **Change Bun version**: Update the `image` property to use a different Bun version
- **Add features**: Add more features from the [Dev Container Features library](https://containers.dev/features)
- **Modify settings**: Adjust VS Code settings in the `settings` object

## Troubleshooting

### Dependencies not installed

If dependencies aren't installed automatically, run:

```bash
bun install
```

### Port not forwarding

Check the **Ports** panel in VS Code and manually forward the port if needed.

### Extensions not loading

Reload the VS Code window: Press `Cmd/Ctrl + Shift + P` and select "Developer: Reload Window"
