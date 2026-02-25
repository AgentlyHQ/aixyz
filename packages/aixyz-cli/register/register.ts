import { encodeFunctionData, formatEther, parseEventLogs, type Chain, type Log } from "viem";
import { IdentityRegistryAbi } from "@aixyz/erc-8004";
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
import { label, truncateUri, broadcastAndConfirm, logSignResult } from "./utils/transaction";
import { promptAgentUrl, promptSupportedTrust, deriveAgentUri } from "./utils/prompt";
import { hasErc8004File, createErc8004File, writeRegistrationEntry } from "./utils/erc8004-file";
import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import boxen from "boxen";
import type { BaseOptions } from "./index";

export interface RegisterOptions extends BaseOptions {
  url?: string;
  chain?: string;
}

export async function register(options: RegisterOptions): Promise<void> {
  // Step 1: Ensure app/erc-8004.ts exists
  if (!hasErc8004File()) {
    console.log(chalk.yellow("No app/erc-8004.ts found. Let's create one."));
    console.log("");
    const supportedTrust = await promptSupportedTrust();
    createErc8004File(supportedTrust);
    console.log(chalk.green("Created app/erc-8004.ts"));
    console.log("");
  }

  // Step 2: Get agent URL and derive URI
  const agentUrl = options.url ?? (await promptAgentUrl());
  const resolvedUri = deriveAgentUri(agentUrl);

  const yes = await confirm({
    message: `Will register URI as: ${chalk.cyan(resolvedUri)} — confirm?`,
    default: true,
  });
  if (!yes) {
    throw new Error("Aborted.");
  }

  // Step 3: Select chain
  const chainName = options.chain ?? (await selectChain());
  const chainConfig = resolveChainConfig(chainName);
  const registryAddress = resolveRegistryAddress(chainName, chainConfig.chainId, options.registry);

  // Step 4: Encode transaction
  const data = encodeFunctionData({
    abi: IdentityRegistryAbi,
    functionName: "register",
    args: [resolvedUri],
  });

  const printTxDetails = (header: string) => {
    console.log("");
    console.log(chalk.dim(header));
    console.log(`  ${label("To")}${registryAddress}`);
    console.log(`  ${label("Data")}${data.slice(0, 10)}${chalk.dim("\u2026" + (data.length - 2) / 2 + " bytes")}`);
    console.log(`  ${label("Chain")}${chainName}`);
    console.log(`  ${label("Function")}register(string memory agentURI)`);
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

  // Step 5: Write registration entry back to app/erc-8004.ts
  if (resultData.agentId !== undefined) {
    const agentRegistry = `eip155:${chainConfig.chainId}:${registryAddress}`;
    writeRegistrationEntry({ agentId: Number(resultData.agentId), agentRegistry });
    console.log("");
    console.log(chalk.green(`Updated app/erc-8004.ts with registration (agentId: ${resultData.agentId})`));
  }

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
