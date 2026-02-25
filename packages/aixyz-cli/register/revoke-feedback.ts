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
import { promptAgentId, promptFeedbackIndex } from "./utils/prompt";
import { parseAgentId, parseFeedbackIndex } from "./utils/validate";

export interface RevokeFeedbackOptions extends BaseOptions {
  agentId?: string;
  feedbackIndex?: string;
}

export async function revokeFeedback(options: RevokeFeedbackOptions): Promise<void> {
  const chainName = options.chain ?? (await selectChain());
  const chainConfig = resolveChainConfig(chainName);

  const agentIdParsed = parseAgentId(options.agentId ?? (await promptAgentId()));
  const feedbackIndexParsed = parseFeedbackIndex(options.feedbackIndex ?? (await promptFeedbackIndex()));

  const registryAddress = resolveRegistryAddress(chainName, chainConfig.chainId, options.registry, "reputation");

  const data = encodeFunctionData({
    abi: ReputationRegistryAbi,
    functionName: "revokeFeedback",
    args: [agentIdParsed, feedbackIndexParsed],
  });

  const printTxDetails = (header: string) => {
    console.log("");
    console.log(chalk.dim(header));
    console.log(`  ${label("To")}${registryAddress}`);
    console.log(`  ${label("Data")}${data.slice(0, 10)}${chalk.dim("\u2026" + (data.length - 2) / 2 + " bytes")}`);
    console.log(`  ${label("Chain")}${chainName}`);
    console.log(`  ${label("Function")}${abiSignature(ReputationRegistryAbi, "revokeFeedback")}`);
    console.log(`  ${label("Agent ID")}${agentIdParsed}`);
    console.log(`  ${label("Index")}${feedbackIndexParsed}`);
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
  // TODO: check if feedback is already revoked (prevent revert)

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
    writeResultJson(options.outDir, "revoke-feedback", resultData);
  }
}

interface RevokeFeedbackResult {
  agentId?: string;
  clientAddress?: string;
  feedbackIndex?: string;
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
): RevokeFeedbackResult {
  const events = parseEventLogs({ abi: ReputationRegistryAbi, logs: receipt.logs });
  const revoked = events.find((e) => e.eventName === "FeedbackRevoked");

  const lines: string[] = [];
  const result: RevokeFeedbackResult = {
    chainId,
    block: receipt.blockNumber.toString(),
    timestamp: new Date(Number(timestamp) * 1000).toUTCString(),
    gasPaid: formatEther(receipt.gasUsed * receipt.effectiveGasPrice),
    nativeCurrency: chain.nativeCurrency?.symbol ?? "ETH",
    txHash: hash,
  };

  if (revoked) {
    const { agentId, clientAddress, feedbackIndex } = revoked.args as {
      agentId: bigint;
      clientAddress: `0x${string}`;
      feedbackIndex: bigint;
    };
    result.agentId = agentId.toString();
    result.clientAddress = clientAddress;
    result.feedbackIndex = feedbackIndex.toString();

    lines.push(`${label("Agent ID")}${chalk.bold(result.agentId)}`);
    lines.push(`${label("Client")}${clientAddress}`);
    lines.push(`${label("Index")}${result.feedbackIndex}`);
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
      title: "Feedback revoked successfully",
      titleAlignment: "left",
    }),
  );

  return result;
}
