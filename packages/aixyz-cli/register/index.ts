import type { WalletOptions } from "./wallet";

export interface BaseOptions extends WalletOptions {
  chain?: string;
  rpcUrl?: string;
  registry?: string;
  outDir?: string;
}
