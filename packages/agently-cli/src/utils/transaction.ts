import { createPublicClient, http, type Chain, type Log } from "viem";
import { startSpinner } from "./spinner.js";
import { getExplorerUrl } from "./chain.js";
import type { SignTransactionResult } from "../wallet/sign.js";
import chalk from "chalk";
import boxen from "boxen";

export function label(text: string): string {
  return chalk.dim(text.padEnd(14));
}

export function truncateUri(uri: string, maxLength = 80): string {
  if (uri.length <= maxLength) return uri;
  return uri.slice(0, maxLength) + "...";
}

export interface BroadcastAndConfirmParams {
  result: SignTransactionResult;
  chain: Chain;
  rpcUrl?: string;
}

export interface BroadcastAndConfirmResult {
  hash: `0x${string}`;
  receipt: {
    blockNumber: bigint;
    gasUsed: bigint;
    effectiveGasPrice: bigint;
    logs: Log[];
  };
  timestamp: bigint;
}

export async function broadcastAndConfirm({
  result,
  chain,
  rpcUrl,
}: BroadcastAndConfirmParams): Promise<BroadcastAndConfirmResult> {
  const transport = rpcUrl ? http(rpcUrl) : http();
  const publicClient = createPublicClient({ chain, transport });

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
    broadcastSpinner.stop(`${chalk.green("\u2713")} Transaction broadcast`);
  }

  printTxHashBox(chain, hash);

  const confirmSpinner = startSpinner("Waiting for confirmation...");
  let receipt;
  try {
    receipt = await publicClient.waitForTransactionReceipt({ hash });
  } catch (err) {
    confirmSpinner.stop();
    throw err;
  }
  confirmSpinner.stop(`${chalk.green("\u2713")} Confirmed in block ${chalk.bold(receipt.blockNumber.toString())}`);

  const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });

  return { hash, receipt, timestamp: block.timestamp };
}

function printTxHashBox(chain: Chain, hash: `0x${string}`): void {
  const lines = [`${label("Tx Hash")}${hash}`];
  const explorerUrl = getExplorerUrl(chain, hash);
  if (explorerUrl) {
    lines.push(`${label("Explorer")}${chalk.cyan(explorerUrl)}`);
  }
  console.log(
    boxen(lines.join("\n"), {
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      borderStyle: "round",
      borderColor: "cyan",
    }),
  );
}

export function logSignResult(walletType: string, result: SignTransactionResult): void {
  if (result.kind === "signed") {
    console.log(`${chalk.green("\u2713")} Transaction signed ${chalk.dim(`(${walletType} \u00b7 ${result.address})`)}`);
  } else {
    console.log(`${chalk.green("\u2713")} Transaction signed ${chalk.dim(`(${walletType})`)}`);
  }
}
