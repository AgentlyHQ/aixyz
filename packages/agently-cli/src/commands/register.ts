import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient,
  encodeFunctionData,
  formatEther,
  http,
  isAddress,
  parseEventLogs,
  type Chain,
  type Log,
} from "viem";
import { mainnet, sepolia, baseSepolia, foundry } from "viem/chains";
import { IdentityRegistryAbi, getIdentityRegistryAddress, CHAIN_ID } from "@agentlyhq/8004";
import { select } from "@inquirer/prompts";
import { selectWalletMethod, type WalletOptions } from "../wallet/index.js";
import { signTransaction } from "../wallet/sign.js";
import { CliError, resolveUri } from "../utils.js";
import { startSpinner } from "../utils/spinner.js";
import chalk from "chalk";
import boxen from "boxen";

interface ChainConfig {
  chain: Chain;
  chainId: number;
}

const CHAINS: Record<string, ChainConfig> = {
  mainnet: { chain: mainnet, chainId: CHAIN_ID.MAINNET },
  sepolia: { chain: sepolia, chainId: CHAIN_ID.SEPOLIA },
  "base-sepolia": { chain: baseSepolia, chainId: CHAIN_ID.BASE_SEPOLIA },
  localhost: { chain: foundry, chainId: 31337 },
};

export interface RegisterOptions extends WalletOptions {
  uri?: string;
  chain?: string;
  rpcUrl?: string;
  registry?: string;
  outDir?: string;
}

export async function register(options: RegisterOptions): Promise<void> {
  const chainName = options.chain ?? (await selectChain());

  const chainConfig = CHAINS[chainName];
  if (!chainConfig) {
    throw new CliError(`Unsupported chain: ${chainName}. Supported chains: ${Object.keys(CHAINS).join(", ")}`);
  }

  // Resolve URI (convert file path to base64 data URI if needed)
  const resolvedUri = options.uri ? resolveUri(options.uri) : undefined;

  if (options.uri && resolvedUri !== options.uri) {
    console.log(`Resolved ${options.uri} to data URI (${resolvedUri!.length} chars)`);
  }

  let registryAddress: `0x${string}`;
  if (options.registry) {
    if (!isAddress(options.registry)) {
      throw new CliError(`Invalid registry address: ${options.registry}`);
    }
    registryAddress = options.registry as `0x${string}`;
  } else if (chainName === "localhost") {
    throw new CliError("--registry is required for localhost (no default contract deployment)");
  } else {
    registryAddress = getIdentityRegistryAddress(chainConfig.chainId) as `0x${string}`;
  }

  // Encode calldata once for all paths
  const data = encodeFunctionData({
    abi: IdentityRegistryAbi,
    functionName: "register",
    args: resolvedUri ? [resolvedUri] : [],
  });

  // Fail fast if both --browser and --rpc-url are explicitly provided
  if (options.browser && options.rpcUrl) {
    throw new CliError("--rpc-url cannot be used with browser wallet. The browser wallet uses its own RPC endpoint.");
  }

  // Determine wallet method (may prompt user interactively)
  const walletMethod = await selectWalletMethod(options);

  // Also guard for the case where user selects browser interactively
  if (walletMethod.type === "browser" && options.rpcUrl) {
    throw new CliError("--rpc-url cannot be used with browser wallet. The browser wallet uses its own RPC endpoint.");
  }

  const label = (text: string) => chalk.dim(text.padEnd(14));

  console.log("");
  console.log(chalk.dim("Signing transaction..."));
  console.log(`  ${label("To")}${registryAddress}`);
  console.log(`  ${label("Data")}${data.slice(0, 10)}${chalk.dim("…" + (data.length - 2) / 2 + " bytes")}`);
  console.log(`  ${label("Chain")}${chainName}`);
  console.log(`  ${label("Function")}${resolvedUri ? "register(string memory agentURI)" : "register()"}`);
  if (resolvedUri) {
    const displayUri = resolvedUri.length > 80 ? resolvedUri.slice(0, 80) + "…" : resolvedUri;
    console.log(`  ${label("URI")}${displayUri}`);
  }
  console.log("");
  const result = await signTransaction({
    walletMethod,
    tx: { to: registryAddress, data },
    chain: chainConfig.chain,
    rpcUrl: options.rpcUrl,
    options: {
      browser: { chainId: chainConfig.chainId, chainName: chainName, uri: resolvedUri },
    },
  });
  if (result.kind === "signed") {
    console.log(`${chalk.green("✓")} Transaction signed ${chalk.dim(`(${walletMethod.type} · ${result.address})`)}`);
  } else {
    console.log(`${chalk.green("✓")} Transaction signed ${chalk.dim(`(${walletMethod.type})`)}`);
  }

  // Broadcast (if needed) and confirm via viem
  const transport = options.rpcUrl ? http(options.rpcUrl) : http();
  const publicClient = createPublicClient({ chain: chainConfig.chain, transport });

  let hash: `0x${string}`;
  if (result.kind === "sent") {
    hash = result.txHash;
  } else {
    const broadcastSpinner = startSpinner("Broadcasting transaction...");
    try {
      hash = await publicClient.sendRawTransaction({ serializedTransaction: result.raw });
    } catch (err) {
      broadcastSpinner.stop();
      throw err;
    }
    broadcastSpinner.stop(`${chalk.green("✓")} Transaction broadcast`);
  }

  const txLines = [`${label("Tx Hash")}${hash}`];
  const explorerUrl = getExplorerUrl(chainConfig.chain, hash);
  if (explorerUrl) {
    txLines.push(`${label("Explorer")}${chalk.cyan(explorerUrl)}`);
  }
  console.log(
    boxen(txLines.join("\n"), {
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      borderStyle: "round",
      borderColor: "cyan",
    }),
  );

  const confirmSpinner = startSpinner("Waiting for confirmation...");
  let receipt;
  try {
    receipt = await publicClient.waitForTransactionReceipt({ hash });
  } catch (err) {
    confirmSpinner.stop();
    throw err;
  }
  confirmSpinner.stop(`${chalk.green("✓")} Confirmed in block ${chalk.bold(receipt.blockNumber.toString())}`);

  const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
  const resultData = printResult(receipt, block.timestamp, chainConfig.chain, chainConfig.chainId, hash, label);

  if (options.outDir) {
    writeResultJson(options.outDir, resultData);
  }
}

interface RegistrationResult {
  agentId?: string;
  owner?: string;
  uri?: string;
  chainId: number;
  block: string;
  timestamp: string;
  gasPaid: string;
  nativeCurrency: string;
  txHash: string;
  explorer?: string;
  metadata?: Record<string, string>;
}

function printResult(
  receipt: { blockNumber: bigint; gasUsed: bigint; effectiveGasPrice: bigint; logs: Log[] },
  timestamp: bigint,
  chain: Chain,
  chainId: number,
  hash: `0x${string}`,
  label: (text: string) => string,
): RegistrationResult {
  const events = parseEventLogs({ abi: IdentityRegistryAbi, logs: receipt.logs });

  const registered = events.find((e) => e.eventName === "Registered");
  const metadataEvents = events.filter((e) => e.eventName === "MetadataSet");

  const lines: string[] = [];
  const result: RegistrationResult = {
    chainId,
    block: receipt.blockNumber.toString(),
    timestamp: new Date(Number(timestamp) * 1000).toUTCString(),
    gasPaid: formatEther(receipt.gasUsed * receipt.effectiveGasPrice),
    nativeCurrency: chain.nativeCurrency?.symbol ?? "ETH",
    txHash: hash,
  };

  if (registered) {
    const { agentId, agentURI, owner } = registered.args as { agentId: bigint; agentURI: string; owner: string };
    result.agentId = agentId.toString();
    result.owner = owner;
    if (agentURI) result.uri = agentURI;

    lines.push(`${label("Agent ID")}${chalk.bold(result.agentId)}`);
    lines.push(`${label("Owner")}${owner}`);
    if (agentURI) {
      const displayUri = agentURI.length > 80 ? agentURI.slice(0, 80) + "..." : agentURI;
      lines.push(`${label("URI")}${displayUri}`);
    }
    lines.push(`${label("Block")}${receipt.blockNumber}`);
  } else {
    lines.push(`${label("Block")}${receipt.blockNumber}`);
  }

  lines.push(`${label("Timestamp")}${result.timestamp}`);
  lines.push(`${label("Gas Paid")}${result.gasPaid} ${result.nativeCurrency}`);
  lines.push(`${label("Tx Hash")}${hash}`);

  const explorerUrl = getExplorerUrl(chain, hash);
  if (explorerUrl) {
    result.explorer = explorerUrl;
    lines.push(`${label("Explorer")}${chalk.cyan(explorerUrl)}`);
  }

  if (metadataEvents.length > 0) {
    result.metadata = {};
    lines.push("");
    lines.push(chalk.dim("Metadata"));
    for (const event of metadataEvents) {
      const { metadataKey, metadataValue } = event.args as { metadataKey: string; metadataValue: string };
      result.metadata[metadataKey] = metadataValue;
      lines.push(`${label(metadataKey)}${metadataValue}`);
    }
  }

  console.log("");
  console.log(
    boxen(lines.join("\n"), {
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      borderStyle: "round",
      borderColor: "green",
      title: "Agent registered successfully",
      titleAlignment: "left",
    }),
  );

  return result;
}

function writeResultJson(outDir: string, result: RegistrationResult): void {
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const filename = `registration-${result.chainId}-${Date.now()}.json`;
  const filePath = join(outDir, filename);
  writeFileSync(filePath, JSON.stringify(result, null, 2) + "\n");
  console.log(`\n${chalk.green("✓")} Result written to ${chalk.bold(filePath)}`);
}

async function selectChain(): Promise<string> {
  return select({
    message: "Select target chain:",
    choices: Object.keys(CHAINS).map((name) => ({ name, value: name })),
  });
}

function getExplorerUrl(chain: Chain, txHash: string): string | null {
  const explorer = chain.blockExplorers?.default;
  if (!explorer) return null;
  return `${explorer.url}/tx/${txHash}`;
}
