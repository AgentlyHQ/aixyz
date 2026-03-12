import type { AixyzApp } from "./index";

export abstract class BasePlugin {
  abstract readonly name: string;
  abstract register(app: AixyzApp): void | Promise<void>;
}
