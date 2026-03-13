import {
  X402FacilitatorLocalContainer,
  type StartedX402FacilitatorLocalContainer,
  accounts,
} from "x402-fl/testcontainers";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { FacilitatorClient } from "@x402/core/server";
import { EvmPrivateKeyWallet } from "@use-agently/sdk";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { AixyzApp } from "../app/index";

export interface X402Fixture {
  container: StartedX402FacilitatorLocalContainer;
  facilitator: FacilitatorClient;
  wallet: EvmPrivateKeyWallet;
  payTo: `0x${string}`;
  network: "eip155:8453";
  rpcUrl: string;
  serve(app: AixyzApp): Promise<{ url: string; stop: () => void }>;
  close(): Promise<void>;
}

export async function createFixture(): Promise<X402Fixture> {
  const container = await new X402FacilitatorLocalContainer().start();

  const privateKey = generatePrivateKey();
  const address = privateKeyToAccount(privateKey).address;
  await container.fund(address, "100");

  const wallet = new EvmPrivateKeyWallet(privateKey, container.getRpcUrl());
  const facilitator = new HTTPFacilitatorClient({ url: container.getFacilitatorUrl() });
  const rpcUrl = container.getRpcUrl();
  const payTo = accounts.facilitator.address as `0x${string}`;

  return {
    container,
    facilitator,
    wallet,
    payTo,
    network: "eip155:8453",
    rpcUrl,
    serve(app: AixyzApp) {
      return new Promise((resolve) => {
        const server = Bun.serve({ fetch: app.fetch.bind(app), port: 0 });
        const url = `http://localhost:${server.port}`;
        resolve({
          url,
          stop: () => server.stop(true),
        });
      });
    },
    async close() {
      await container.stop();
    },
  };
}
