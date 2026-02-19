# aixyz-cli

[![npm](https://img.shields.io/npm/v/aixyz-cli)](https://www.npmjs.com/package/aixyz-cli)

CLI for building and deploying [aixyz](https://ai-xyz.dev) agents.

## Quick Start

Run without installing:

```bash
bunx aixyz-cli dev
npx aixyz-cli dev
```

> Note: Requires [Bun](https://bun.sh) to be installed on your system.

## Installation

```bash
bun add aixyz-cli
```

## Commands

### `aixyz-cli dev`

Start a local development server with file watching and auto-restart.

```bash
aixyz-cli dev
aixyz-cli dev --port 8080
```

### `aixyz-cli build`

Build the agent for Vercel deployment using the [Build Output API v3](https://vercel.com/docs/build-output-api/v3).

```bash
aixyz-cli build
```

## Shell Completion

aixyz-cli supports shell autocompletion for commands and options.

### Setup

**Zsh:**

```bash
# One-time setup
source <(aixyz-cli complete zsh)

# Or permanently add to your .zshrc
aixyz-cli complete zsh > ~/.aixyz-completion.zsh
echo 'source ~/.aixyz-completion.zsh' >> ~/.zshrc
```

**Bash:**

```bash
# One-time setup
source <(aixyz-cli complete bash)

# Or permanently add to your .bashrc
aixyz-cli complete bash > ~/.aixyz-completion.bash
echo 'source ~/.aixyz-completion.bash' >> ~/.bashrc
```

**Fish:**

```bash
aixyz-cli complete fish > ~/.config/fish/completions/aixyz-cli.fish
```

**PowerShell:**

```powershell
# Add to your PowerShell profile
aixyz-cli complete powershell | Out-String | Invoke-Expression
```

Once set up, you can use Tab to autocomplete commands and options:

```bash
aixyz-cli <TAB>        # Shows: dev, build, complete
aixyz-cli dev --<TAB>  # Shows: --port
```

## License

MIT
