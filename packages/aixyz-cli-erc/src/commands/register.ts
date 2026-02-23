import { encodeFunctionData, formatEther, parseEventLogs, type Chain, type Log } from "viem";
import { IdentityRegistryAbi } from "@aixyz/erc-8004";
import { selectWalletMethod, type WalletOptions } from "../wallet/index";
import { signTransaction } from "../wallet/sign";
import { resolveUri } from "../utils";
import {
  resolveChainConfig,
  selectChain,
  resolveRegistryAddress,
  validateBrowserRpcConflict,
  getExplorerUrl,
} from "../utils/chain";
import { writeResultJson } from "../utils/result";
import { label, truncateUri, broadcastAndConfirm, logSignResult } from "../utils/transaction";
import chalk from "chalk";
import boxen from "boxen";
import type { BaseOptions } from "../index";

export interface RegisterOptions extends BaseOptions {
  uri?: string;
  chain?: string;
}

export async function register(options: RegisterOptions): Promise<void> {
  const chainName = options.chain ?? (await selectChain());
  const chainConfig = resolveChainConfig(chainName);

  const resolvedUri = options.uri ? resolveUri(options.uri) : undefined;
  if (options.uri && resolvedUri !== options.uri) {
    console.log(`Resolved ${options.uri} to data URI (${resolvedUri!.length} chars)`);
  }

  const registryAddress = resolveRegistryAddress(chainName, chainConfig.chainId, options.registry);

  const data = encodeFunctionData({
    abi: IdentityRegistryAbi,
    functionName: "register",
    args: resolvedUri ? [resolvedUri] : [],
  });

  const printTxDetails = (header: string) => {
    console.log("");
    console.log(chalk.dim(header));
    console.log(`  ${label("To")}${registryAddress}`);
    console.log(`  ${label("Data")}${data.slice(0, 10)}${chalk.dim("\u2026" + (data.length - 2) / 2 + " bytes")}`);
    console.log(`  ${label("Chain")}${chainName}`);
    console.log(`  ${label("Function")}${resolvedUri ? "register(string memory agentURI)" : "register()"}`);
    if (resolvedUri) {
      console.log(`  ${label("URI")}${truncateUri(resolvedUri)}`);
    }
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
    writeResultJson(options.outDir, "registration", resultData);
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
      lines.push(`${label("URI")}${truncateUri(agentURI)}`);
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
