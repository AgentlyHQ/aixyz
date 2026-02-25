import { encodeFunctionData, formatEther, formatUnits, parseEventLogs, type Chain, type Log } from "viem";
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
import { promptAgentId, promptFeedbackValue, promptValueDecimals } from "./utils/prompt";
import { parseAgentId, parseFeedbackValue, parseValueDecimals, parseBytes32Hash } from "./utils/validate";

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

export interface GiveFeedbackOptions extends BaseOptions {
  agentId?: string;
  value?: string;
  valueDecimals?: string;
  tag1?: string;
  tag2?: string;
  endpoint?: string;
  feedbackUri?: string;
  feedbackHash?: string;
}

export async function giveFeedback(options: GiveFeedbackOptions): Promise<void> {
  const chainName = options.chain ?? (await selectChain());
  const chainConfig = resolveChainConfig(chainName);

  const agentIdParsed = parseAgentId(options.agentId ?? (await promptAgentId()));
  const valueParsed = parseFeedbackValue(options.value ?? (await promptFeedbackValue()));
  const decimalsParsed = parseValueDecimals(options.valueDecimals ?? (await promptValueDecimals()));

  const tag1 = options.tag1 ?? "";
  const tag2 = options.tag2 ?? "";
  const endpoint = options.endpoint ?? "";
  const feedbackUri = options.feedbackUri ?? "";
  const feedbackHashRaw = options.feedbackHash ?? ZERO_BYTES32;
  const feedbackHash =
    feedbackHashRaw !== ZERO_BYTES32
      ? parseBytes32Hash(feedbackHashRaw, "feedback hash")
      : (ZERO_BYTES32 as `0x${string}`);

  const registryAddress = resolveRegistryAddress(chainName, chainConfig.chainId, options.registry, "reputation");

  const data = encodeFunctionData({
    abi: ReputationRegistryAbi,
    functionName: "giveFeedback",
    args: [agentIdParsed, valueParsed, decimalsParsed, tag1, tag2, endpoint, feedbackUri, feedbackHash],
  });

  const printTxDetails = (header: string) => {
    console.log("");
    console.log(chalk.dim(header));
    console.log(`  ${label("To")}${registryAddress}`);
    console.log(`  ${label("Data")}${data.slice(0, 10)}${chalk.dim("\u2026" + (data.length - 2) / 2 + " bytes")}`);
    console.log(`  ${label("Chain")}${chainName}`);
    console.log(`  ${label("Function")}${abiSignature(ReputationRegistryAbi, "giveFeedback")}`);
    console.log(`  ${label("Agent ID")}${agentIdParsed}`);
    const displayValue =
      decimalsParsed > 0 ? `${valueParsed} (${formatUnits(valueParsed, decimalsParsed)})` : `${valueParsed}`;
    console.log(`  ${label("Value")}${displayValue}`);
    console.log(`  ${label("Decimals")}${decimalsParsed}`);
    console.log(`  ${label("Tag1")}${tag1}`);
    console.log(`  ${label("Tag2")}${tag2}`);
    console.log(`  ${label("Endpoint")}${endpoint}`);
    console.log(`  ${label("Feedback URI")}${feedbackUri}`);
    console.log(`  ${label("Feedback Hash")}${feedbackHash}`);
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

  // TODO: do simple check if agentId exists.
  // TODO: do simple check if self-feedback (to save gas and avoid revert)

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
    writeResultJson(options.outDir, "give-feedback", resultData);
  }
}

interface GiveFeedbackResult {
  agentId?: string;
  clientAddress?: string;
  feedbackIndex?: string;
  value?: string;
  valueDecimals?: string;
  tag1?: string;
  tag2?: string;
  endpoint?: string;
  feedbackUri?: string;
  feedbackHash?: string;
  chainId: number;
  block: string;
  timestamp: string;
  gasPaid: string;
  nativeCurrency: string;
  txHash: string;
  explorer?: string;
}

function printResult(
  receipt: { blockNumber: bigint; gasUsed: bigint; effectiveGasPrice: bigint; logs: Log[] },
  timestamp: bigint,
  chain: Chain,
  chainId: number,
  hash: `0x${string}`,
): GiveFeedbackResult {
  const events = parseEventLogs({ abi: ReputationRegistryAbi, logs: receipt.logs });
  const newFeedback = events.find((e) => e.eventName === "NewFeedback");

  const lines: string[] = [];
  const result: GiveFeedbackResult = {
    chainId,
    block: receipt.blockNumber.toString(),
    timestamp: new Date(Number(timestamp) * 1000).toUTCString(),
    gasPaid: formatEther(receipt.gasUsed * receipt.effectiveGasPrice),
    nativeCurrency: chain.nativeCurrency?.symbol ?? "ETH",
    txHash: hash,
  };

  if (newFeedback) {
    const {
      agentId,
      clientAddress,
      feedbackIndex,
      value,
      valueDecimals,
      tag1,
      tag2,
      endpoint,
      feedbackURI,
      feedbackHash,
    } = newFeedback.args as {
      agentId: bigint;
      clientAddress: `0x${string}`;
      feedbackIndex: bigint;
      value: bigint;
      valueDecimals: number;
      tag1: string;
      tag2: string;
      endpoint: string;
      feedbackURI: string;
      feedbackHash: `0x${string}`;
    };
    result.agentId = agentId.toString();
    result.clientAddress = clientAddress;
    result.feedbackIndex = feedbackIndex.toString();
    result.value = value.toString();
    result.valueDecimals = valueDecimals.toString();
    result.tag1 = tag1;
    result.tag2 = tag2;
    result.endpoint = endpoint;
    result.feedbackUri = feedbackURI;
    result.feedbackHash = feedbackHash;

    lines.push(`${label("Agent ID")}${chalk.bold(result.agentId)}`);
    lines.push(`${label("Client")}${clientAddress}`);
    lines.push(`${label("Index")}${result.feedbackIndex}`);
    const displayValue = valueDecimals > 0 ? `${value} (${formatUnits(value, valueDecimals)})` : `${value}`;
    lines.push(`${label("Value")}${displayValue}`);
    lines.push(`${label("Decimals")}${valueDecimals}`);
    lines.push(`${label("Tag1")}${tag1}`);
    lines.push(`${label("Tag2")}${tag2}`);
    lines.push(`${label("Endpoint")}${endpoint}`);
    lines.push(`${label("Feedback URI")}${feedbackURI}`);
    lines.push(`${label("Feedback Hash")}${feedbackHash}`);
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
      title: "Feedback submitted successfully",
      titleAlignment: "left",
    }),
  );

  return result;
}
