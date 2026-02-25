import { Command } from "commander";
import { BaseOptions } from "./types";
import { register } from "./register";
import { update } from "./update";
import { handleAction } from "../utils";

export type { BaseOptions };

export const erc8004Command = new Command("erc-8004").description("ERC-8004 IdentityRegistry operations");

erc8004Command
  .command("register")
  .description("Register a new agent to the ERC-8004 IdentityRegistry")
  .option("--url <url>", "Agent deployment URL (e.g., https://my-agent.example.com)")
  .option("--chain <chain>", "Target chain (mainnet, sepolia, base-sepolia, localhost)")
  .option("--rpc-url <url>", "Custom RPC URL (uses default if not provided)")
  .option("--registry <address>", "Contract address of the IdentityRegistry (required for localhost)")
  .option("--keystore <path>", "Path to Ethereum keystore (V3) JSON file for local signing")
  .option("--browser", "Use browser extension wallet (any extension)")
  .option("--broadcast", "Sign and broadcast the transaction (default: dry-run)")
  .option("--out-dir <path>", "Write deployment result as JSON to the given directory")
  .addHelpText(
    "after",
    `
Option Details:
  --url <url>
      Agent deployment URL (e.g., https://my-agent.example.com).
      The registration URI will be derived as <url>/_aixyz/erc-8004.json.
      If omitted, you will be prompted to enter the URL interactively.

  --chain <chain>
      Target chain for registration. Supported values:
        mainnet       Ethereum mainnet (chain ID 1)
        sepolia       Ethereum Sepolia testnet (chain ID 11155111)
        base-sepolia  Base Sepolia testnet (chain ID 84532)
        localhost     Local Foundry/Anvil node (chain ID 31337)
      If omitted, you will be prompted to select a chain interactively.

  --rpc-url <url>
      Custom RPC endpoint URL. Overrides the default RPC for the selected
      chain. Cannot be used with --browser since the browser wallet manages
      its own RPC connection.

  --registry <address>
      Contract address of the ERC-8004 IdentityRegistry. Only required for
      localhost, where there is no default deployment.

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

Behavior:
  If app/erc-8004.ts does not exist, you will be prompted to create it
  (selecting supported trust mechanisms). After a successful on-chain
  registration, the new registration entry is written back to app/erc-8004.ts.

Environment Variables:
  PRIVATE_KEY    Private key (hex, with or without 0x prefix) used for signing.

Examples:
  # Dry-run (default)
  $ aixyz erc-8004 register --url "https://my-agent.example.com" --chain sepolia

  # Sign and broadcast
  $ aixyz erc-8004 register --url "https://my-agent.example.com" --chain sepolia --keystore ~/.foundry/keystores/default --broadcast
  $ aixyz erc-8004 register --url "https://my-agent.example.com" --chain sepolia --browser --broadcast`,
  )
  .action(handleAction(register));

erc8004Command
  .command("update")
  .description("Update the metadata URI of a registered agent")
  .option("--url <url>", "New agent deployment URL (e.g., https://my-agent.example.com)")
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
  $ aixyz erc-8004 update --url "https://new-domain.example.com" --browser --broadcast`,
  )
  .action(handleAction(update));
