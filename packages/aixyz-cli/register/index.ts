import { Command } from "commander";
import { register } from "./register";
import { update } from "./update";
import type { WalletOptions } from "./wallet";

export interface BaseOptions extends WalletOptions {
  rpcUrl?: string;
  registry?: string;
  outDir?: string;
}

export const erc8004Command = new Command("erc-8004").description("ERC-8004 IdentityRegistry operations");

erc8004Command
  .command("register")
  .description("Register a new agent to the ERC-8004 IdentityRegistry")
  .option("--url <url>", "Agent deployment URL (e.g., https://my-agent.example.com)")
  .option("--chain-id <chainId>", "Target chain by numeric chain ID", parseInt)
  .option("--rpc-url <url>", "Custom RPC URL (uses default if not provided)")
  .option("--registry <address>", "Contract address of the IdentityRegistry (required for localhost and custom chains)")
  .option("--keystore <path>", "Path to Ethereum keystore (V3) JSON file for local signing")
  .option("--browser", "Use browser extension wallet (any extension)")
  .option("--broadcast", "Sign and broadcast the transaction (default: dry-run)")
  .option("--out-dir <path>", "Write deployment result as JSON to the given directory")
  .option(
    "--supported-trust <values>",
    'Comma-separated supported trust mechanisms (e.g., "reputation,tee-attestation"). If omitted and app/erc-8004.ts does not exist, you will be prompted interactively.',
  )
  .addHelpText(
    "after",
    `
Option Details:
  --url <url>
      Agent deployment URL (e.g., https://my-agent.example.com).
      The registration URI will be derived as <url>/_aixyz/erc-8004.json.
      If omitted, you will be prompted to enter the URL interactively.

  --chain-id <chainId>
      Target chain by numeric chain ID. Supported chain IDs include:
        1 (mainnet), 8453 (base), 42161 (arbitrum), 10 (optimism),
        137 (polygon), 56 (bsc), 43114 (avalanche), 11155111 (sepolia),
        84532 (base-sepolia), and more (see @aixyz/erc-8004).
      If omitted, you will be prompted to select a chain interactively.
      Use any custom EVM chain ID with --rpc-url for BYO chains.

  --rpc-url <url>
      Custom RPC endpoint URL. Overrides the default RPC for the selected
      chain. Required when using a custom chain ID with no default deployment.
      Cannot be used with --browser since the browser wallet manages
      its own RPC connection.

  --registry <address>
      Contract address of the ERC-8004 IdentityRegistry. Required for
      localhost and custom chains, where there is no default deployment.

  --keystore <path>
      Path to an Ethereum keystore (V3) JSON file. You will be prompted for
      the keystore password to decrypt the private key for signing.

  --browser
      Opens a local page in your default browser for signing with any
      EIP-6963 compatible wallet extension (MetaMask, Rabby, etc.).

  --broadcast
      Sign and broadcast the transaction on-chain. Without this flag the
      command performs a dry-run.

  --out-dir <path>
      Directory to write the deployment result as a JSON file.

  --supported-trust <values>
      Comma-separated list of trust mechanisms to declare in app/erc-8004.ts
      when it does not yet exist. Valid values: reputation, crypto-economic,
      tee-attestation, social, governance.
      Example: --supported-trust "reputation,tee-attestation"
      If omitted, you will be prompted to select interactively.

Behavior:
  If app/erc-8004.ts does not exist, you will be prompted to create it
  (selecting supported trust mechanisms). After a successful on-chain
  registration, the new registration entry is written back to app/erc-8004.ts.

Environment Variables:
  PRIVATE_KEY    Private key (hex, with or without 0x prefix) used for signing.

Examples:
  # Dry-run (default)
  $ aixyz erc-8004 register --url "https://my-agent.example.com" --chain-id 11155111

  # Sign and broadcast (known chain)
  $ aixyz erc-8004 register --url "https://my-agent.example.com" --chain-id 84532 --keystore ~/.foundry/keystores/default --broadcast
  $ aixyz erc-8004 register --url "https://my-agent.example.com" --chain-id 84532 --browser --broadcast

  # Non-interactive (CI-friendly)
  $ aixyz erc-8004 register --url "https://my-agent.example.com" --chain-id 84532 --supported-trust "reputation,tee-attestation" --keystore ~/.foundry/keystores/default --broadcast

  # BYO: register on any custom EVM chain
  $ aixyz erc-8004 register --url "https://my-agent.example.com" --chain-id 999999 --rpc-url https://my-rpc.example.com --registry 0xABCD... --broadcast`,
  )
  .action(register);

erc8004Command
  .command("update")
  .description("Update the metadata URI of a registered agent")
  .option("--url <url>", "New agent deployment URL (e.g., https://my-agent.example.com)")
  .option("--agent-id <id>", "Agent ID to update (selects which registration from app/erc-8004.ts)", parseInt)
  .option("--rpc-url <url>", "Custom RPC URL (uses default if not provided)")
  .option("--registry <address>", "Contract address of the IdentityRegistry (required for localhost)")
  .option("--keystore <path>", "Path to Ethereum keystore (V3) JSON file for local signing")
  .option("--browser", "Use browser extension wallet (any extension)")
  .option("--broadcast", "Sign and broadcast the transaction (default: dry-run)")
  .option("--out-dir <path>", "Write result as JSON to the given directory")
  .addHelpText(
    "after",
    `
Option Details:
  --url <url>
      New agent deployment URL (e.g., https://my-agent.example.com).
      The URI will be derived as <url>/_aixyz/erc-8004.json.
      If omitted, you will be prompted to enter the URL interactively.

  --agent-id <id>
      Agent ID (numeric) to select which registration from app/erc-8004.ts
      to update. Required in non-interactive (non-TTY) mode when multiple
      registrations exist.

  --rpc-url <url>
      Custom RPC endpoint URL. Overrides the default RPC for the selected
      chain. Cannot be used with --browser.

  --registry <address>
      Contract address of the ERC-8004 IdentityRegistry. Only required for
      localhost, where there is no default deployment.

  --keystore <path>
      Path to an Ethereum keystore (V3) JSON file.

  --browser
      Opens a local page in your default browser for signing with any
      EIP-6963 compatible wallet extension (MetaMask, Rabby, etc.).

  --broadcast
      Sign and broadcast the transaction on-chain. Without this flag the
      command performs a dry-run.

  --out-dir <path>
      Directory to write the result as a JSON file.

Behavior:
  Reads existing registrations from app/erc-8004.ts. If there is one
  registration, confirms it. If multiple, prompts you to select which
  one to update. The chain and registry address are derived from the
  selected registration's agentRegistry field.

Environment Variables:
  PRIVATE_KEY    Private key (hex, with or without 0x prefix) used for signing.

Examples:
  # Dry-run (default)
  $ aixyz erc-8004 update --url "https://new-domain.example.com"

  # Sign and broadcast
  $ aixyz erc-8004 update --url "https://new-domain.example.com" --keystore ~/.foundry/keystores/default --broadcast
  $ aixyz erc-8004 update --url "https://new-domain.example.com" --browser --broadcast

  # Non-interactive (CI-friendly)
  $ aixyz erc-8004 update --url "https://new-domain.example.com" --agent-id 42 --keystore ~/.foundry/keystores/default --broadcast`,
  )
  .action(update);
