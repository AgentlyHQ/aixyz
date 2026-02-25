#!/usr/bin/env bun
import { program } from "commander";
import { build } from "./build";
import { dev } from "./dev";
import { register } from "./register/register";
import { setAgentUri } from "./register/set-agent-uri";
import { giveFeedback } from "./register/give-feedback";
import { revokeFeedback } from "./register/revoke-feedback";
import { appendResponse } from "./register/append-response";
import pkg from "./package.json";

function handleAction(
  action: (options: Record<string, unknown>) => Promise<void>,
): (options: Record<string, unknown>) => Promise<void> {
  return async (options) => {
    try {
      await action(options);
    } catch (error) {
      if (error instanceof Error && error.name === "ExitPromptError") {
        process.exit(130);
      }
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  };
}

program.name("aixyz").description("CLI for building and deploying aixyz agents").version(pkg.version);

program
  .command("dev")
  .description("Start a local development server")
  .option("-p, --port <port>", "Port to listen on", "3000")
  .action(handleAction(dev));

program
  .command("build")
  .description("Build the aixyz agent")
  .option("--output <type>", "Output format: 'standalone' or 'vercel'")
  .addHelpText(
    "after",
    `
Details:
  Bundles your aixyz agent for deployment.

  Default behavior (auto-detected):
    Bundles into a single executable file for Standalone at ./.aixyz/output/server.js

  With --output vercel or VERCEL=1 env:
    Generates Vercel Build Output API v3 structure at .vercel/output/
    (Automatically detected when deploying to Vercel)

  The build process:
    1. Loads aixyz.config.ts from the current directory
    2. Detects entrypoint (app/server.ts or auto-generates from app/agent.ts + app/tools/)
    3. Bundles the application
    4. Copies static assets from public/ (if present)

Prerequisites:
  - An aixyz.config.ts with a default export
  - An entrypoint at app/server.ts, or app/agent.ts + app/tools/ for auto-generation

Examples:
  $ aixyz build                         # Build standalone (default)
  $ aixyz build --output standalone     # Build standalone explicitly
  $ aixyz build --output vercel         # Build for Vercel deployment
  $ VERCEL=1 aixyz build                # Auto-detected Vercel build`,
  )
  .action(handleAction(build));

const erc8004 = program.command("erc-8004").description("ERC-8004 registry operations");

erc8004
  .command("register")
  .description("Register a new agent to the ERC-8004 IdentityRegistry")
  .option("--uri <uri>", "Agent metadata URI or path to .json file (converts to base64 data URI)")
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
  --uri <uri>
      Agent metadata as a URI or local file path. Accepts http://, https://,
      ipfs://, and data: URIs directly.
      If a .json file path is given, it is read and converted to a base64 data URI automatically.
      Otherwise, the URI is used as-is and the validity of the URI is not checked.
      If omitted, the agent is registered without metadata.

  --chain <chain>
      Target chain for registration. Supported values:
        mainnet       Ethereum mainnet (chain ID 1)
        sepolia       Ethereum Sepolia testnet (chain ID 11155111)
        base-sepolia  Base Sepolia testnet (chain ID 84532)
        localhost     Local Foundry/Anvil node (chain ID 31337)
      If omitted, you will be prompted to select a chain interactively.
      Each chain has a default RPC endpoint unless overridden with --rpc-url.

  --rpc-url <url>
      Custom RPC endpoint URL. Overrides the default RPC for the selected
      chain. Cannot be used with --browser since the browser wallet manages
      its own RPC connection.

  --registry <address>
      Contract address of the ERC-8004 IdentityRegistry. Only required for
      localhost, where there is no default deployment. For mainnet, sepolia,
      and base-sepolia the canonical registry address is used automatically.

  --keystore <path>
      Path to an Ethereum keystore (V3) JSON file. You will be prompted for
      the keystore password to decrypt the private key for signing.

  --browser
      Opens a local page in your default browser for signing with any
      EIP-6963 compatible wallet extension (MetaMask, Rabby, etc.).
      The wallet handles both signing and broadcasting the transaction.
      Cannot be combined with --rpc-url.

  --broadcast
      Sign and broadcast the transaction on-chain. Without this flag the
      command performs a dry-run: it encodes the transaction and prints
      its details but does not interact with any wallet or send anything
      to the network.

  --out-dir <path>
      Directory to write the deployment result as a JSON file. The file
      is named registration-<chainId>-<timestamp>.json.

Environment Variables:
  PRIVATE_KEY    Private key (hex, with or without 0x prefix) used for
                 signing. Detected automatically if set. Not recommended
                 for interactive use as the key may appear in shell history.

Examples:
  # Dry-run (default) — shows encoded transaction, no wallet needed
  $ aixyz erc-8004 register --uri "./metadata.json" --chain sepolia

  # Sign and broadcast
  $ aixyz erc-8004 register --uri "./metadata.json" --chain sepolia --keystore ~/.foundry/keystores/default --broadcast
  $ PRIVATE_KEY=0x... aixyz erc-8004 register --chain sepolia --broadcast
  $ aixyz erc-8004 register --chain localhost --registry 0x5FbDB2315678afecb367f032d93F642f64180aa3 --uri "./metadata.json" --broadcast
  $ aixyz erc-8004 register --uri "./metadata.json" --chain sepolia --browser --broadcast`,
  )
  .action(handleAction(register));

erc8004
  .command("set-agent-uri")
  .description("Update the metadata URI of a registered agent")
  .option("--agent-id <id>", "Agent ID (token ID) to update")
  .option("--uri <uri>", "New agent metadata URI or path to .json file")
  .option("--chain <chain>", "Target chain (mainnet, sepolia, base-sepolia, localhost)")
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
  --agent-id <id>
      The token ID of the agent whose URI you want to update.
      Must be a non-negative integer. Only the agent owner, an approved
      address, or an operator can update the URI.
      If omitted, you will be prompted to enter the agent ID interactively.

  --uri <uri>
      New agent metadata as a URI or local file path. Accepts http://, https://,
      ipfs://, and data: URIs directly.
      If a .json file path is given, it is read and converted to a base64 data URI automatically.
      Otherwise, the URI is used as-is and the validity of the URI is not checked.
      If omitted, you will be prompted to enter the URI interactively.

  --chain <chain>
      Target chain. Supported values:
        mainnet       Ethereum mainnet (chain ID 1)
        sepolia       Ethereum Sepolia testnet (chain ID 11155111)
        base-sepolia  Base Sepolia testnet (chain ID 84532)
        localhost     Local Foundry/Anvil node (chain ID 31337)
      If omitted, you will be prompted to select a chain interactively.
      Each chain has a default RPC endpoint unless overridden with --rpc-url.

  --rpc-url <url>
      Custom RPC endpoint URL. Overrides the default RPC for the selected
      chain. Cannot be used with --browser since the browser wallet manages
      its own RPC connection.

  --registry <address>
      Contract address of the ERC-8004 IdentityRegistry. Only required for
      localhost, where there is no default deployment. For mainnet, sepolia,
      and base-sepolia the canonical registry address is used automatically.

  --keystore <path>
      Path to an Ethereum keystore (V3) JSON file. You will be prompted for
      the keystore password to decrypt the private key for signing.

  --browser
      Opens a local page in your default browser for signing with any
      EIP-6963 compatible wallet extension (MetaMask, Rabby, etc.).
      The wallet handles both signing and broadcasting the transaction.
      Cannot be combined with --rpc-url.

  --broadcast
      Sign and broadcast the transaction on-chain. Without this flag the
      command performs a dry-run: it encodes the transaction and prints
      its details but does not interact with any wallet or send anything
      to the network.

  --out-dir <path>
      Directory to write the result as a JSON file. The file
      is named set-agent-uri-<chainId>-<timestamp>.json.

Environment Variables:
  PRIVATE_KEY    Private key (hex, with or without 0x prefix) used for
                 signing. Detected automatically if set. Not recommended
                 for interactive use as the key may appear in shell history.

Examples:
  # Dry-run (default) — shows encoded transaction, no wallet needed
  $ aixyz erc-8004 set-agent-uri --agent-id 1 --uri "./metadata.json" --chain sepolia

  # Sign and broadcast
  $ aixyz erc-8004 set-agent-uri --agent-id 1 --uri "./metadata.json" --chain sepolia --keystore ~/.foundry/keystores/default --broadcast
  $ PRIVATE_KEY=0x... aixyz erc-8004 set-agent-uri --agent-id 42 --uri "https://example.com/agent.json" --chain sepolia --broadcast
  $ aixyz erc-8004 set-agent-uri --agent-id 1 --uri "./metadata.json" --chain localhost --registry 0x5FbDB2315678afecb367f032d93F642f64180aa3 --broadcast
  $ aixyz erc-8004 set-agent-uri --agent-id 1 --uri "./metadata.json" --chain sepolia --browser --broadcast`,
  )
  .action(handleAction(setAgentUri));

erc8004
  .command("give-feedback")
  .description("Submit feedback for a registered agent on the ReputationRegistry")
  .option("--agent-id <id>", "Agent ID (token ID) to give feedback for")
  .option("--value <value>", "Feedback value (signed integer)")
  .option("--value-decimals <decimals>", "Value decimals (0-18)")
  .option("--tag1 <tag>", "Primary tag (category)")
  .option("--tag2 <tag>", "Secondary tag (subcategory)")
  .option("--endpoint <endpoint>", "Endpoint related to the feedback")
  .option("--feedback-uri <uri>", "URI with additional feedback details")
  .option("--feedback-hash <hash>", "Bytes32 hash of feedback content")
  .option("--chain <chain>", "Target chain (mainnet, sepolia, base-sepolia, localhost)")
  .option("--rpc-url <url>", "Custom RPC URL (uses default if not provided)")
  .option("--registry <address>", "Contract address of the ReputationRegistry (required for localhost)")
  .option("--keystore <path>", "Path to Ethereum keystore (V3) JSON file for local signing")
  .option("--browser", "Use browser extension wallet (any extension)")
  .option("--broadcast", "Sign and broadcast the transaction (default: dry-run)")
  .option("--out-dir <path>", "Write result as JSON to the given directory")
  .action(handleAction(giveFeedback));

erc8004
  .command("revoke-feedback")
  .description("Revoke previously submitted feedback on the ReputationRegistry")
  .option("--agent-id <id>", "Agent ID (token ID) of the feedback to revoke")
  .option("--feedback-index <index>", "Feedback index to revoke")
  .option("--chain <chain>", "Target chain (mainnet, sepolia, base-sepolia, localhost)")
  .option("--rpc-url <url>", "Custom RPC URL (uses default if not provided)")
  .option("--registry <address>", "Contract address of the ReputationRegistry (required for localhost)")
  .option("--keystore <path>", "Path to Ethereum keystore (V3) JSON file for local signing")
  .option("--browser", "Use browser extension wallet (any extension)")
  .option("--broadcast", "Sign and broadcast the transaction (default: dry-run)")
  .option("--out-dir <path>", "Write result as JSON to the given directory")
  .action(handleAction(revokeFeedback));

erc8004
  .command("append-response")
  .description("Append a response to existing feedback on the ReputationRegistry")
  .option("--agent-id <id>", "Agent ID (token ID) of the feedback")
  .option("--client-address <address>", "Ethereum address of the feedback author")
  .option("--feedback-index <index>", "Feedback index to respond to")
  .option("--response-uri <uri>", "URI with response details")
  .option("--response-hash <hash>", "Bytes32 hash of response content")
  .option("--chain <chain>", "Target chain (mainnet, sepolia, base-sepolia, localhost)")
  .option("--rpc-url <url>", "Custom RPC URL (uses default if not provided)")
  .option("--registry <address>", "Contract address of the ReputationRegistry (required for localhost)")
  .option("--keystore <path>", "Path to Ethereum keystore (V3) JSON file for local signing")
  .option("--browser", "Use browser extension wallet (any extension)")
  .option("--broadcast", "Sign and broadcast the transaction (default: dry-run)")
  .option("--out-dir <path>", "Write result as JSON to the given directory")
  .action(handleAction(appendResponse));

program.parse();
