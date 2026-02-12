import { encodeFunctionData, formatEther, parseEventLogs, type Chain, type Log } from "viem";
import { IdentityRegistryAbi } from "@agentlyhq/erc-8004";
import { selectWalletMethod, type WalletOptions } from "../wallet/index.js";
import { signTransaction } from "../wallet/sign.js";
import { CliError, resolveUri } from "../utils.js";
import {
  resolveChainConfig,
  selectChain,
  resolveRegistryAddress,
  validateBrowserRpcConflict,
  getExplorerUrl,
} from "../utils/chain.js";
import { writeResultJson } from "../utils/result.js";
import { label, truncateUri, broadcastAndConfirm, logSignResult } from "../utils/transaction.js";
import { confirm, input } from "@inquirer/prompts";
import chalk from "chalk";
import boxen from "boxen";

export interface SetAgentUriOptions extends WalletOptions {
  agentId?: string;
  uri?: string;
  chain?: string;
  rpcUrl?: string;
  registry?: string;
  outDir?: string;
}

async function promptAgentId(): Promise<string> {
  return input({
    message: "Agent ID (token ID) to update:",
    validate: (value) => {
      const n = Number(value);
      if (value.trim() === "" || !Number.isInteger(n) || n < 0) return "Must be a non-negative integer";
      return true;
    },
  });
}

async function promptUri(): Promise<string> {
  return input({
    message: "New agent metadata URI or path to .json file (leave empty to clear):",
  });
}

async function confirmEmptyUri(): Promise<void> {
  const yes = await confirm({
    message: "URI is empty. This will clear the agent's metadata URI. Are you sure?",
    default: false,
  });
  if (!yes) {
    throw new CliError("Aborted.");
  }
}

export function validateAgentId(agentId: string): void {
  const n = Number(agentId);
  if (agentId.trim() === "" || !Number.isInteger(n) || n < 0) {
    throw new CliError(`Invalid agent ID: ${agentId}. Must be a non-negative integer.`);
  }
}

export async function setAgentUri(options: SetAgentUriOptions): Promise<void> {
  const chainName = options.chain ?? (await selectChain());
  const chainConfig = resolveChainConfig(chainName);

  const agentId = options.agentId ?? (await promptAgentId());
  validateAgentId(agentId);

  const uri = options.uri ?? (await promptUri());
  if (uri === "") {
    await confirmEmptyUri();
  }
  const resolvedUri = uri === "" ? "" : resolveUri(uri);
  if (resolvedUri !== uri) {
    console.log(`Resolved ${uri} to data URI (${resolvedUri.length} chars)`);
  }

  const registryAddress = resolveRegistryAddress(chainName, chainConfig.chainId, options.registry);

  const data = encodeFunctionData({
    abi: IdentityRegistryAbi,
    functionName: "setAgentURI",
    args: [BigInt(agentId), resolvedUri],
  });

  const printTxDetails = (header: string) => {
    console.log("");
    console.log(chalk.dim(header));
    console.log(`  ${label("To")}${registryAddress}`);
    console.log(`  ${label("Data")}${data.slice(0, 10)}${chalk.dim("\u2026" + (data.length - 2) / 2 + " bytes")}`);
    console.log(`  ${label("Chain")}${chainName}`);
    console.log(`  ${label("Function")}setAgentURI(uint256 agentId, string calldata newURI)`);
    console.log(`  ${label("Agent ID")}${agentId}`);
    console.log(`  ${label("URI")}${truncateUri(resolvedUri)}`);
    console.log("");
  };

  validateBrowserRpcConflict(options.browser, options.rpcUrl);

  if (!options.broadcast) {
    if (options.browser || options.keystore || process.env.PRIVATE_KEY) {
      console.warn("Note: --browser/--keystore/PRIVATE_KEY ignored in dry-run mode. Pass --broadcast to use a wallet.");
    }
    printTxDetails("Transaction details (dry-run)");
    console.log("Dry-run complete. To sign and broadcast, re-run with --broadcast.");
    return;
  }

  const walletMethod = await selectWalletMethod(options);
  validateBrowserRpcConflict(walletMethod.type === "browser" || undefined, options.rpcUrl);

  printTxDetails("Signing transaction...");

  const result = await signTransaction({
    walletMethod,
    tx: { to: registryAddress, data },
    chain: chainConfig.chain,
    rpcUrl: options.rpcUrl,
    options: {
      browser: { chainId: chainConfig.chainId, chainName, uri: resolvedUri },
    },
  });
  logSignResult(walletMethod.type, result);

  const { hash, receipt, timestamp } = await broadcastAndConfirm({
    result,
    chain: chainConfig.chain,
    rpcUrl: options.rpcUrl,
  });

  const resultData = printResult(receipt, timestamp, chainConfig.chain, chainConfig.chainId, hash);

  if (options.outDir) {
    writeResultJson(options.outDir, "set-agent-uri", resultData);
  }
}

interface SetAgentUriResult {
  agentId?: string;
  newUri?: string;
  updatedBy?: `0x${string}`;
  chainId: number;
  block: string;
  timestamp: string;
  gasPaid: string;
  nativeCurrency: string;
  txHash: string;
  explorer?: string;
}

function printResult(
  receipt: { blockNumber: bigint; gasUsed: bigint; effectiveGasPrice: bigint; logs: readonly unknown[] },
  timestamp: bigint,
  chain: Chain,
  chainId: number,
  hash: `0x${string}`,
): SetAgentUriResult {
  const events = parseEventLogs({ abi: IdentityRegistryAbi, logs: receipt.logs as Log[] });
  const uriUpdated = events.find((e) => e.eventName === "URIUpdated");

  const lines: string[] = [];
  const result: SetAgentUriResult = {
    chainId,
    block: receipt.blockNumber.toString(),
    timestamp: new Date(Number(timestamp) * 1000).toUTCString(),
    gasPaid: formatEther(receipt.gasUsed * receipt.effectiveGasPrice),
    nativeCurrency: chain.nativeCurrency?.symbol ?? "ETH",
    txHash: hash,
  };

  if (uriUpdated) {
    const { agentId, newURI, updatedBy } = uriUpdated.args as {
      agentId: bigint;
      newURI: string;
      updatedBy: `0x${string}`;
    };
    result.agentId = agentId.toString();
    result.newUri = newURI;
    result.updatedBy = updatedBy;

    lines.push(`${label("Agent ID")}${chalk.bold(result.agentId)}`);
    lines.push(`${label("New URI")}${truncateUri(newURI)}`);
    lines.push(`${label("Updated By")}${updatedBy}`);
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

  console.log("");
  console.log(
    boxen(lines.join("\n"), {
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      borderStyle: "round",
      borderColor: "green",
      title: "Agent URI updated successfully",
      titleAlignment: "left",
    }),
  );

  return result;
}
