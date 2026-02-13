import { getAixyzConfig, LoadedAixyzConfig, Network } from "../config";
import initExpress from "express";
import { x402ResourceServer } from "@x402/core/server";
import { paymentMiddleware, PaymentRequirements } from "@x402/express";
import { getFacilitatorClient } from "../facilitator";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { z } from "zod";

export type X402Accepts = {
  price: string;
  scheme?: "exact";
  network?: string;
  payTo?: string;
};

/**
 * With x402 configured.
 */
export class AixyzApp {
  constructor(
    public config: LoadedAixyzConfig,
    public x402Server: x402ResourceServer,
    public express: initExpress.Express = initExpress(),
  ) {}

  static async init(): Promise<AixyzApp> {
    const config = getAixyzConfig();
    const facilitator = getFacilitatorClient();
    const x402Server = new x402ResourceServer(facilitator).register(config.x402.network as any, new ExactEvmScheme());
    await x402Server.initialize();

    return new AixyzApp(config, x402Server);
  }

  // TODO(@fuxingloh): add back x402 Bazaar compatibility

  private withAccepts(accepts: X402Accepts) {
    const schema = z.object({
      scheme: z.enum(["exact"]).default("exact"),
      price: z.string(),
      payTo: z.string().default(this.config.x402.payTo),
      network: z
        .custom<Network>((val) => {
          return typeof val === "string" && val.includes(":");
        })
        .default(this.config.x402.network ?? this.config.network),
    });

    return schema.parse(accepts);
  }

  withX402(route: `${"GET" | "POST"} /${string}`, accepts: X402Accepts) {
    this.express.use(
      paymentMiddleware(
        {
          "POST /agent": {
            accepts: this.withAccepts(accepts),
            mimeType: "application/json",
            description: `A2A Payment: ${this.config.description}`,
          },
        },
        this.x402Server,
      ),
    );
  }

  async withPaymentRequirements(accepts: X402Accepts): Promise<PaymentRequirements[]> {
    return this.x402Server.buildPaymentRequirements(this.withAccepts(accepts));
  }
}
