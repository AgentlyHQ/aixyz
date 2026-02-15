import { getAixyzConfig, Network } from "../config";
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

// TODO(@fuxingloh): rename to unstable_AixyzApp?
export class AixyzServer extends x402ResourceServer {
  constructor(
    public config = getAixyzConfig(),
    public express: initExpress.Express = initExpress(),
  ) {
    super(getFacilitatorClient());
    this.register(config.x402.network as any, new ExactEvmScheme());
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
    // this part is deleting
    this.express.use(
      paymentMiddleware(
        {
          [route]: {
            accepts: this.withAccepts(accepts),
            mimeType: "application/json",
            description: `A2A Payment: ${this.config.description}`,
          },
        },
        this,
        undefined,
        undefined,
        false,
      ),
    );
  }

  async withPaymentRequirements(accepts: X402Accepts): Promise<PaymentRequirements[]> {
    return this.buildPaymentRequirements(this.withAccepts(accepts));
  }
}
