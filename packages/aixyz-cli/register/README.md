# ERC-8004 Registry Commands

CLI commands for registering agents to the [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) IdentityRegistry.

These commands are part of the `aixyz` CLI under the `erc8004` subcommand.

## Usage

### Register an Agent

Register a new agent to the IdentityRegistry with multiple wallet options:

#### Using Keystore (Recommended)

Sign with an Ethereum keystore (V3) JSON file:

```bash
aixyz erc8004 register --uri "./metadata.json" --chain sepolia --keystore ~/.foundry/keystores/default --broadcast
```

#### Using Browser Wallet

Opens a localhost page to sign with any browser extension wallet (MetaMask, Rabby, etc.) that are `EIP-6963` compliant:

```bash
aixyz erc8004 register --uri "ipfs://Qm..." --chain sepolia --browser --broadcast
```

> **Note:** `--rpc-url` cannot be used with `--browser`. The browser wallet uses its own RPC endpoint.

#### Using Private Key Env (Not Recommended)

For scripting and CI:

```bash
# Not recommended for interactive use
PRIVATE_KEY=0x... aixyz erc8004 register --uri "ipfs://Qm..." --chain sepolia --broadcast
```

#### Interactive Mode

If no wallet option is provided, you'll be prompted to choose:

```bash
aixyz erc8004 register --uri "ipfs://Qm..." --chain sepolia --broadcast
```

#### Local Development

Register against a local Foundry/Anvil node:

```bash
aixyz erc8004 register \
  --chain localhost \
  --registry 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  --rpc-url http://localhost:8545 \
  --uri "./metadata.json" \
  --keystore ~/.foundry/keystores/default \
  --broadcast
```

### Set Agent URI

Update the metadata URI of a registered agent:

```bash
aixyz erc8004 set-agent-uri \
  --agent-id 1 \
  --uri "https://my-agent.vercel.app/.well-known/agent-card.json" \
  --chain sepolia \
  --keystore ~/.foundry/keystores/default \
  --broadcast
```

### Options

| Option                 | Description                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `--uri <uri>`          | Agent metadata URI or path to `.json` file (converts to base64 data URI)             |
| `--chain <chain>`      | Target chain: `mainnet`, `sepolia`, `base-sepolia`, `localhost` (default: `sepolia`) |
| `--rpc-url <url>`      | Custom RPC URL (cannot be used with `--browser`)                                     |
| `--registry <address>` | IdentityRegistry contract address (required for `localhost`)                         |
| `--keystore <path>`    | Path to Ethereum keystore (V3) JSON file                                             |
| `--browser`            | Use browser extension wallet                                                         |
| `--broadcast`          | Sign and broadcast the transaction (default: dry-run)                                |
| `--out-dir <path>`     | Write deployment result as JSON to the given directory                               |

### Environment Variables

| Variable      | Description                           |
| ------------- | ------------------------------------- |
| `PRIVATE_KEY` | Private key for signing (use caution) |

### Supported Chains

| Chain          | Chain ID | Network                  |
| -------------- | -------- | ------------------------ |
| `mainnet`      | 1        | Ethereum mainnet         |
| `sepolia`      | 11155111 | Ethereum Sepolia testnet |
| `base-sepolia` | 84532    | Base Sepolia testnet     |
| `localhost`    | 31337    | Local Foundry/Anvil node |
