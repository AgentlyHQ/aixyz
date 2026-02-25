import { encodeFunctionData, formatEther, parseEventLogs, type Chain, type Log } from "viem";
import { IdentityRegistryAbi } from "@aixyz/erc-8004";
import { selectWalletMethod } from "./wallet";
import { signTransaction } from "./wallet/sign";
import { resolveChainConfigById, validateBrowserRpcConflict, getExplorerUrl, CHAINS } from "./utils/chain";
import { writeResultJson } from "./utils/result";
import { label, truncateUri, broadcastAndConfirm, logSignResult } from "./utils/transaction";
import { promptAgentUrl, promptSelectRegistration, deriveAgentUri } from "./utils/prompt";
import { readRegistrations } from "./utils/erc8004-file";
import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import boxen from "boxen";
import type { BaseOptions } from "./index";

export interface UpdateOptions extends BaseOptions {
  url?: string;
}

export async function update(options: UpdateOptions): Promise<void> {
  // Step 1: Read registrations from app/erc-8004.ts
  const registrations = await readRegistrations();

  if (registrations.length === 0) {
    throw new Error("No registrations found in app/erc-8004.ts. Run `aixyz erc-8004 register` first.");
  }

  // Step 2: Select which registration to update
  const selected = await promptSelectRegistration(registrations);

  // Step 3: Derive chain info from agentRegistry (eip155:<chainId>:<address>)
  const parts = selected.agentRegistry.split(":");
  if (parts.length < 3 || parts[0] !== "eip155") {
    throw new Error(`Invalid agentRegistry format: ${selected.agentRegistry}. Expected eip155:<chainId>:<address>`);
  }

  const chainId = Number(parts[1]);
  const registryAddress = parts.slice(2).join(":") as `0x${string}`;
  const chainName = Object.entries(CHAINS).find(([, config]) => config.chainId === chainId)?.[0] ?? `chain-${chainId}`;
  const chainConfig = resolveChainConfigById(chainId, options.rpcUrl);

  // Step 4: Get new agent URL and derive URI
  const agentUrl = options.url ?? (await promptAgentUrl());
  const resolvedUri = deriveAgentUri(agentUrl);

  const yes = await confirm({
    message: `Will update URI to: ${chalk.cyan(resolvedUri)} — confirm?`,
    default: true,
  });
  if (!yes) {
    throw new Error("Aborted.");
  }

  // Step 5: Encode transaction
  const data = encodeFunctionData({
    abi: IdentityRegistryAbi,
    functionName: "setAgentURI",
    args: [BigInt(selected.agentId), resolvedUri],
  });

  const printTxDetails = (header: string) => {
    console.log("");
    console.log(chalk.dim(header));
    console.log(`  ${label("To")}${registryAddress}`);
    console.log(`  ${label("Data")}${data.slice(0, 10)}${chalk.dim("\u2026" + (data.length - 2) / 2 + " bytes")}`);
    console.log(`  ${label("Chain")}${chainName}`);
    console.log(`  ${label("Function")}setAgentURI(uint256 agentId, string calldata newURI)`);
    console.log(`  ${label("Agent ID")}${selected.agentId}`);
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
      browser: { chainId: chainConfig.chainId, chainName, uri: resolvedUri, mode: "update" },
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
    writeResultJson(options.outDir, "update", resultData);
  }
}

interface UpdateResult {
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
): UpdateResult {
  const events = parseEventLogs({ abi: IdentityRegistryAbi, logs: receipt.logs as Log[] });
  const uriUpdated = events.find((e) => e.eventName === "URIUpdated");

  const lines: string[] = [];
  const result: UpdateResult = {
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
