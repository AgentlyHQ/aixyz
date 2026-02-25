import { encodeFunctionData, formatEther, parseEventLogs, type Chain, type Log } from "viem";
import { ReputationRegistryAbi } from "@aixyz/erc-8004";
import { selectWalletMethod } from "./wallet";
import { signTransaction } from "./wallet/sign";
import {
  resolveChainConfig,
  selectChain,
  resolveRegistryAddress,
  validateBrowserRpcConflict,
  getExplorerUrl,
} from "./utils/chain";
import { writeResultJson } from "./utils/result";
import { label, abiSignature, broadcastAndConfirm, logSignResult } from "./utils/transaction";
import chalk from "chalk";
import boxen from "boxen";
import type { BaseOptions } from "./index";
import { promptAgentId, promptFeedbackIndex, promptClientAddress, promptResponseUri } from "./utils/prompt";
import { parseAgentId, parseFeedbackIndex, parseClientAddress, parseBytes32Hash } from "./utils/validate";

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

export interface AppendResponseOptions extends BaseOptions {
  agentId?: string;
  clientAddress?: string;
  feedbackIndex?: string;
  responseUri?: string;
  responseHash?: string;
}

export async function appendResponse(options: AppendResponseOptions): Promise<void> {
  const chainName = options.chain ?? (await selectChain());
  const chainConfig = resolveChainConfig(chainName);

  const agentIdParsed = parseAgentId(options.agentId ?? (await promptAgentId()));
  const clientAddressParsed = parseClientAddress(options.clientAddress ?? (await promptClientAddress()));
  const feedbackIndexParsed = parseFeedbackIndex(options.feedbackIndex ?? (await promptFeedbackIndex()));

  const responseUri = options.responseUri ?? (await promptResponseUri());
  if (responseUri.trim() === "") {
    throw new Error("Response URI must not be empty.");
  }
  const responseHashRaw = options.responseHash ?? ZERO_BYTES32;
  const responseHash =
    responseHashRaw !== ZERO_BYTES32
      ? parseBytes32Hash(responseHashRaw, "response hash")
      : (ZERO_BYTES32 as `0x${string}`);

  const registryAddress = resolveRegistryAddress(chainName, chainConfig.chainId, options.registry, "reputation");

  const data = encodeFunctionData({
    abi: ReputationRegistryAbi,
    functionName: "appendResponse",
    args: [agentIdParsed, clientAddressParsed, feedbackIndexParsed, responseUri, responseHash],
  });

  const printTxDetails = (header: string) => {
    console.log("");
    console.log(chalk.dim(header));
    console.log(`  ${label("To")}${registryAddress}`);
    console.log(`  ${label("Data")}${data.slice(0, 10)}${chalk.dim("\u2026" + (data.length - 2) / 2 + " bytes")}`);
    console.log(`  ${label("Chain")}${chainName}`);
    console.log(`  ${label("Function")}${abiSignature(ReputationRegistryAbi, "appendResponse")}`);
    console.log(`  ${label("Agent ID")}${agentIdParsed}`);
    console.log(`  ${label("Client")}${clientAddressParsed}`);
    console.log(`  ${label("Index")}${feedbackIndexParsed}`);
    if (responseUri) console.log(`  ${label("Response URI")}${responseUri}`);
    if (responseHash !== ZERO_BYTES32) console.log(`  ${label("Response Hash")}${responseHash}`);
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

  // TODO: check feedbackIndex is within lastIndex (prevent revert)

  const walletMethod = await selectWalletMethod(options);
  validateBrowserRpcConflict(walletMethod.type === "browser" || undefined, options.rpcUrl);

  printTxDetails("Signing transaction...");

  const result = await signTransaction({
    walletMethod,
    tx: { to: registryAddress, data },
    chain: chainConfig.chain,
    rpcUrl: options.rpcUrl,
    options: {
      browser: { chainId: chainConfig.chainId, chainName },
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
    writeResultJson(options.outDir, "append-response", resultData);
  }
}

interface AppendResponseResult {
  agentId?: string;
  clientAddress?: string;
  feedbackIndex?: string;
  responder?: string;
  responseUri?: string;
  responseHash?: string;
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
): AppendResponseResult {
  const events = parseEventLogs({ abi: ReputationRegistryAbi, logs: receipt.logs as Log[] });
  const responseAppended = events.find((e) => e.eventName === "ResponseAppended");

  const lines: string[] = [];
  const result: AppendResponseResult = {
    chainId,
    block: receipt.blockNumber.toString(),
    timestamp: new Date(Number(timestamp) * 1000).toUTCString(),
    gasPaid: formatEther(receipt.gasUsed * receipt.effectiveGasPrice),
    nativeCurrency: chain.nativeCurrency?.symbol ?? "ETH",
    txHash: hash,
  };

  if (responseAppended) {
    const { agentId, clientAddress, feedbackIndex, responder, responseURI, responseHash } = responseAppended.args as {
      agentId: bigint;
      clientAddress: `0x${string}`;
      feedbackIndex: bigint;
      responder: `0x${string}`;
      responseURI: string;
      responseHash: `0x${string}`;
    };
    result.agentId = agentId.toString();
    result.clientAddress = clientAddress;
    result.feedbackIndex = feedbackIndex.toString();
    result.responder = responder;
    result.responseUri = responseURI;
    result.responseHash = responseHash;

    lines.push(`${label("Agent ID")}${chalk.bold(result.agentId)}`);
    lines.push(`${label("Client")}${clientAddress}`);
    lines.push(`${label("Index")}${result.feedbackIndex}`);
    lines.push(`${label("Responder")}${responder}`);
    lines.push(`${label("Response URI")}${responseURI}`);
    lines.push(`${label("Response Hash")}${responseHash}`);
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
      title: "Response appended successfully",
      titleAlignment: "left",
    }),
  );

  return result;
}
