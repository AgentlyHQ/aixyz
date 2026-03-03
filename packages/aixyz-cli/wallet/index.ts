import { Command } from "commander";
import { existsSync, copyFileSync } from "node:fs";
import { generateLocalWallet, getLocalWalletPath } from "../register/wallet/local";
import chalk from "chalk";
import boxen from "boxen";

const generateCommand = new Command("generate")
  .description("Generate a new local wallet and save to .aixyz/wallet.json")
  .option("--force", "Overwrite existing wallet")
  .addHelpText(
    "after",
    `
Details:
  Generates a new BIP-39 mnemonic wallet and saves it to .aixyz/wallet.json.
  Also creates .aixyz/.gitignore and .aixyz/.aiignore to protect the wallet
  from being accidentally committed or read by AI tools.

  The generated wallet can be used with \`aixyz erc-8004 register --broadcast\`
  without providing a separate --keystore or PRIVATE_KEY.

  WARNING: The mnemonic in .aixyz/wallet.json grants full access to the wallet.
  Keep it secure and never share it.

Examples:
  $ aixyz wallet generate
  $ aixyz wallet generate --force`,
  )
  .action(async (options: { force?: boolean }) => {
    const walletPath = getLocalWalletPath();

    if (existsSync(walletPath) && !options.force) {
      console.error(chalk.red(`Wallet already exists at ${walletPath}`));
      console.error(chalk.dim("Use --force to overwrite."));
      process.exit(1);
    }

    if (existsSync(walletPath) && options.force) {
      const backupPath = `${walletPath}.${Date.now()}.bak`;
      copyFileSync(walletPath, backupPath);
      console.log(chalk.dim(`Backed up existing wallet to ${backupPath}`));
    }

    let wallet;
    try {
      wallet = generateLocalWallet();
    } catch (err) {
      console.error(chalk.red(`Failed to generate wallet: ${err instanceof Error ? err.message : String(err)}`));
      console.error(chalk.dim("Check that the current directory is writable."));
      process.exit(1);
    }

    const lines = [
      `${chalk.dim("Address")}  ${wallet.address}`,
      `${chalk.dim("Mnemonic")} ${wallet.mnemonic}`,
      `${chalk.dim("Path")}     ${walletPath}`,
    ];

    console.log("");
    console.log(
      boxen(lines.join("\n"), {
        padding: { left: 1, right: 1, top: 0, bottom: 0 },
        borderStyle: "round",
        borderColor: "green",
        title: "Wallet generated",
        titleAlignment: "left",
      }),
    );
    console.log("");
    console.log(chalk.yellow("⚠  Keep your mnemonic secret. Anyone with it can access your funds."));
    console.log(chalk.dim("   .aixyz/.gitignore and .aixyz/.aiignore have been written to protect wallet.json."));
  });

export const walletCommand = new Command("wallet").description("Manage local wallet").addCommand(generateCommand);
