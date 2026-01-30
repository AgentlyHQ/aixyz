#!/usr/bin/env bun
import { program } from "commander";
import { register } from "./commands/register.js";
import { CliError } from "./utils.js";
import pkg from "../package.json";

program.name("agently-cli").description("CLI for ERC-8004 agent registry operations").version(pkg.version);

program
  .command("register")
  .description("Register a new agent to the 8004 IdentityRegistry")
  .option("--uri <uri>", "Agent metadata URI or path to .json file (converts to base64 data URI)")
  .option("--chain <chain>", "Target chain (mainnet, sepolia, base-sepolia, localhost)")
  .option("--rpc-url <url>", "Custom RPC URL (uses default if not provided)")
  .option("--registry <address>", "Contract address of the IdentityRegistry (required for localhost)")
  .option("--keystore <path>", "Path to Ethereum keystore (V3) JSON file for local signing")
  .option("--browser", "Use browser extension wallet (any extension)")
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

  --out-dir <path>
      Directory to write the deployment result as a JSON file. The file
      is named registration-<chainId>-<timestamp>.json.

Environment Variables:
  PRIVATE_KEY    Private key (hex, with or without 0x prefix) used for
                 signing. Detected automatically if set. Not recommended
                 for interactive use as the key may appear in shell history.

Examples:
  $ agently-cli register --uri "./metadata.json" --chain sepolia --keystore ~/.foundry/keystores/default
  $ PRIVATE_KEY=0x... agently-cli register --chain sepolia
  $ agently-cli register --chain localhost --registry 0x5FbDB2315678afecb367f032d93F642f64180aa3 --uri "./metadata.json"
  $ agently-cli register --uri "./metadata.json" --chain sepolia --browser`,
  )
  .action(async (options) => {
    try {
      await register(options);
    } catch (error) {
      if (error instanceof CliError) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
      // handle ctrl-c exit
      if (error instanceof Error && error.name === "ExitPromptError") {
        process.exit(130);
      }
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();
