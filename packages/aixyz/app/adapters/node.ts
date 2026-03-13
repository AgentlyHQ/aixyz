import { createDispatcher } from "../dispatcher";
import type { AixyzApp } from "../index";

export function toFetch(app: AixyzApp): (request: Request) => Promise<Response> {
  return createDispatcher(app);
}
