import { resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { generateMnemonic, mnemonicToAccount, english } from "viem/accounts";
import { bytesToHex } from "viem";

const WALLET_DIR = ".aixyz";
const WALLET_FILE = "wallet.json";
const GITIGNORE_CONTENT = "wallet.json\n";
const AIIGNORE_CONTENT = "wallet.json\n";

export interface LocalWallet {
  mnemonic: string;
  address: string;
}

export function getLocalWalletPath(cwd: string = process.cwd()): string {
  return resolve(cwd, WALLET_DIR, WALLET_FILE);
}

export function hasLocalWallet(cwd?: string): boolean {
  return existsSync(getLocalWalletPath(cwd));
}

export function readLocalWallet(cwd?: string): LocalWallet {
  const path = getLocalWalletPath(cwd);
  if (!existsSync(path)) {
    throw new Error(`No local wallet found at ${path}. Run \`aixyz wallet generate\` to create one.`);
  }
  const content = readFileSync(path, "utf-8");
  return JSON.parse(content) as LocalWallet;
}

export function generateLocalWallet(cwd: string = process.cwd()): LocalWallet {
  const dir = resolve(cwd, WALLET_DIR);
  mkdirSync(dir, { recursive: true });

  // Write .gitignore and .aiignore to protect wallet.json
  writeFileSync(resolve(dir, ".gitignore"), GITIGNORE_CONTENT, "utf-8");
  writeFileSync(resolve(dir, ".aiignore"), AIIGNORE_CONTENT, "utf-8");

  const mnemonic = generateMnemonic(english);
  const account = mnemonicToAccount(mnemonic);

  const wallet: LocalWallet = {
    mnemonic,
    address: account.address,
  };

  writeFileSync(resolve(dir, WALLET_FILE), JSON.stringify(wallet, null, 2) + "\n", "utf-8");

  return wallet;
}

export function getLocalWalletPrivateKey(cwd?: string): `0x${string}` {
  const { mnemonic } = readLocalWallet(cwd);
  const account = mnemonicToAccount(mnemonic);
  const hdKey = account.getHdKey();
  if (!hdKey.privKeyBytes) {
    throw new Error("Failed to derive private key from mnemonic.");
  }
  return bytesToHex(hdKey.privKeyBytes);
}
